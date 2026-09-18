import { db } from '../db/localDb'
import { supabase, isDemoMode } from '../../../shared/lib/supabaseClient'

let isSyncInProgress = false

/** Disparado quando a fila detecta que o token de sessão não é mais aceito pelo Supabase. */
export const AUTH_REQUIRED_EVENT = 'atlas-ponto:auth-required'

export interface SyncResult {
  totalProcessed: number
  successCount: number
  failedCount: number
  authPausedCount: number
  errors: string[]
  circuitOpen?: boolean
}

// ============================================================================
// Circuit Breaker
// Se o Supabase começar a devolver erro de servidor (5xx) ou a rede cair em
// bloco, martelar a fila a cada 15s (useSyncManager) só afunda quem já está
// no ar. Depois de N falhas de servidor seguidas o disjuntor "desarma" e
// bloqueia novas tentativas por um cooldown — processSyncQueue retorna sem
// nem tentar tocar a rede enquanto ele estiver aberto.
// ============================================================================
const CIRCUIT_FAILURE_THRESHOLD = 5
const CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutos

let consecutiveServerFailures = 0
let circuitOpenUntil = 0

function isCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil
}

function recordServerFailure(): void {
  consecutiveServerFailures += 1
  if (consecutiveServerFailures >= CIRCUIT_FAILURE_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS
  }
}

function recordServerSuccess(): void {
  consecutiveServerFailures = 0
  circuitOpenUntil = 0
}

/** Usado pela UI (banner de sincronização) para avisar o colaborador do cooldown. */
export function getCircuitBreakerStatus(): { isOpen: boolean; openUntil: number | null } {
  return { isOpen: isCircuitOpen(), openUntil: circuitOpenUntil || null }
}

/**
 * Reconhece falhas "de servidor/rede" (transitórias, candidatas a abrir o disjuntor) —
 * diferente de erro de auth (trata sessão) ou 4xx de validação (payload ruim, não é
 * culpa do Supabase estar fora do ar e não deve contar para o disjuntor).
 */
function isServerOrNetworkError(error: any): boolean {
  const status = error?.status ?? error?.originalError?.status
  if (typeof status === 'number') return status >= 500
  // Erros de fetch sem status (rede caiu, DNS, timeout) chegam sem `status`.
  return status === undefined
}

// ============================================================================
// Exponential Backoff com Jitter
// Falha transitória de rede não deve reentrar no ritmo fixo de 15s do
// useSyncManager — isso faz 100 celulares martelarem o banco juntos assim que
// o Wi-Fi da empresa volta. Cada registro ganha um `nextRetryAt` crescente
// (2s, 4s, 8s, 16s, 32s...) com jitter aleatório para espalhar as tentativas.
// ============================================================================
const BACKOFF_BASE_MS = 2000
const BACKOFF_MAX_MS = 5 * 60 * 1000 // teto de 5 minutos entre tentativas
const BACKOFF_JITTER_MS = 1000

function computeNextRetryAt(retryCount: number): string {
  const exponential = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** retryCount)
  const jitter = Math.random() * BACKOFF_JITTER_MS
  return new Date(Date.now() + exponential + jitter).toISOString()
}

/**
 * Reconhece falhas de autorização/sessão expirada (não confundir com erro transitório de rede
 * ou payload inválido). Cobre o status HTTP quando presente, o código PostgREST de JWT expirado
 * (PGRST301) e o código do Postgres para violação de RLS (42501, que é o formato que o
 * Supabase realmente devolve quando `auth.uid()` não bate com `user_id`).
 */
function isAuthError(error: any): boolean {
  const status = error?.status ?? error?.originalError?.status
  if (status === 401 || status === 403) return true

  const code = error?.code
  if (code === 'PGRST301' || code === '42501') return true

  const message = String(error?.message || '').toLowerCase()
  return /jwt|token expired|invalid.*session|not authenticated/.test(message)
}

/**
 * Processa a fila de registros offline e envia ao Supabase.
 * Erros de autorização pausam a fila (status 'paused_auth') em vez de consumir tentativas —
 * reenviar um token morto 5x só atrasa o aviso de "faça login de novo" para o colaborador.
 */
export async function processSyncQueue(): Promise<SyncResult> {
  if (isSyncInProgress) {
    return { totalProcessed: 0, successCount: 0, failedCount: 0, authPausedCount: 0, errors: ['Sincronização já em andamento'] }
  }

  // Se não houver internet, não tenta drenar a fila
  if (!navigator.onLine) {
    return { totalProcessed: 0, successCount: 0, failedCount: 0, authPausedCount: 0, errors: ['Dispositivo offline'] }
  }

  if (isCircuitOpen()) {
    return {
      totalProcessed: 0,
      successCount: 0,
      failedCount: 0,
      authPausedCount: 0,
      errors: ['Disjuntor aberto — Supabase reportou falhas seguidas, pausando novas tentativas temporariamente'],
      circuitOpen: true,
    }
  }

  isSyncInProgress = true
  const result: SyncResult = { totalProcessed: 0, successCount: 0, failedCount: 0, authPausedCount: 0, errors: [] }
  let authRequiredDispatched = false

  try {
    const now = new Date().toISOString()
    const allPending = await db.punches
      .where('syncStatus')
      .equals('pending')
      .sortBy('clientTimestamp')

    // Ignora, por enquanto, registros ainda dentro da janela de backoff exponencial.
    const pendingPunches = allPending.filter((p) => !p.nextRetryAt || p.nextRetryAt <= now)

    if (pendingPunches.length === 0) {
      return result
    }

    result.totalProcessed = pendingPunches.length

    for (const record of pendingPunches) {
      if (isCircuitOpen()) {
        result.circuitOpen = true
        result.errors.push('Disjuntor abriu no meio do lote — restante fica para a próxima janela')
        break
      }

      try {
        // Marca como sincronizando
        await db.punches.update(record.id, { syncStatus: 'syncing' })

        if (isDemoMode) {
          // Modo Demonstração Inteligente: simula latência de rede realista de 350ms
          await new Promise((resolve) => setTimeout(resolve, 350))
          await db.punches.update(record.id, {
            syncStatus: 'synced',
            syncedAt: new Date().toISOString(),
          })
          result.successCount++
        } else {
          // Envio real ao Supabase com Upsert idempotente na PK 'id'
          const payload = {
            id: record.id,
            user_id: record.userId,
            colaborador_id: record.colaboradorId,
            punch_type: record.punchType,
            client_timestamp: record.clientTimestamp,
            latitude: record.coords?.latitude,
            longitude: record.coords?.longitude,
            accuracy_meters: record.coords?.accuracy,
            is_offline: record.isOffline,
            is_out_of_bounds: record.auditMetadata?.isOutOfBounds ?? false,
            distance_from_hq_meters: record.auditMetadata?.distanceFromHqMeters,
            audit_metadata: record.auditMetadata || {},
          }

          const { error } = await supabase.from('time_entries').upsert(payload, {
            onConflict: 'id',
            ignoreDuplicates: true,
          })

          if (error) {
            throw error
          }

          await db.punches.update(record.id, {
            syncStatus: 'synced',
            syncedAt: new Date().toISOString(),
          })
          result.successCount++
          recordServerSuccess()
        }
      } catch (err: any) {
        if (isAuthError(err)) {
          await db.punches.update(record.id, { syncStatus: 'paused_auth' })
          result.authPausedCount++
          result.errors.push(`Sessão expirada/sem autorização — fila pausada no registro ${record.id}`)

          if (!authRequiredDispatched) {
            authRequiredDispatched = true
            window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT))
          }

          // Sem token válido, os próximos registros vão falhar pelo mesmo motivo — para o lote aqui.
          break
        }

        if (isServerOrNetworkError(err)) {
          recordServerFailure()
        }

        const nextRetry = (record.retryCount || 0) + 1
        await db.punches.update(record.id, {
          syncStatus: nextRetry >= 5 ? 'failed' : 'pending',
          retryCount: nextRetry,
          nextRetryAt: nextRetry >= 5 ? undefined : computeNextRetryAt(nextRetry),
        })
        result.failedCount++
        result.errors.push(`Erro no registro ${record.id}: ${err?.message || 'Erro desconhecido'}`)

        if (isCircuitOpen()) {
          result.circuitOpen = true
          result.errors.push('Disjuntor aberto após falhas seguidas de servidor — pausando novas tentativas por alguns minutos')
          break
        }
      }
    }
  } finally {
    isSyncInProgress = false
  }

  return result
}

/**
 * Reabre a fila pausada por falta de autorização, devolvendo os registros para 'pending'.
 * Deve ser chamado logo após um novo login bem-sucedido.
 */
export async function resumePausedAuthQueue(): Promise<void> {
  const paused = await db.punches.where('syncStatus').equals('paused_auth').toArray()
  if (paused.length === 0) return

  await db.punches.bulkUpdate(
    paused.map((p) => ({ key: p.id, changes: { syncStatus: 'pending' as const } }))
  )
}
