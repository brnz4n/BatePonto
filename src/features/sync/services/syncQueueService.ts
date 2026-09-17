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

  isSyncInProgress = true
  const result: SyncResult = { totalProcessed: 0, successCount: 0, failedCount: 0, authPausedCount: 0, errors: [] }
  let authRequiredDispatched = false

  try {
    const pendingPunches = await db.punches
      .where('syncStatus')
      .equals('pending')
      .sortBy('clientTimestamp')

    if (pendingPunches.length === 0) {
      return result
    }

    result.totalProcessed = pendingPunches.length

    for (const record of pendingPunches) {
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

        const nextRetry = (record.retryCount || 0) + 1
        await db.punches.update(record.id, {
          syncStatus: nextRetry >= 5 ? 'failed' : 'pending',
          retryCount: nextRetry,
        })
        result.failedCount++
        result.errors.push(`Erro no registro ${record.id}: ${err?.message || 'Erro desconhecido'}`)
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
