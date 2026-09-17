import { db } from '../db/localDb'
import { supabase, isDemoMode } from '../../../shared/lib/supabaseClient'

let isSyncInProgress = false

export interface SyncResult {
  totalProcessed: number
  successCount: number
  failedCount: number
  errors: string[]
}

/**
 * Processa a fila de registros offline e envia ao Supabase
 */
export async function processSyncQueue(): Promise<SyncResult> {
  if (isSyncInProgress) {
    return { totalProcessed: 0, successCount: 0, failedCount: 0, errors: ['Sincronização já em andamento'] }
  }

  // Se não houver internet, não tenta drenar a fila
  if (!navigator.onLine) {
    return { totalProcessed: 0, successCount: 0, failedCount: 0, errors: ['Dispositivo offline'] }
  }

  isSyncInProgress = true
  const result: SyncResult = { totalProcessed: 0, successCount: 0, failedCount: 0, errors: [] }

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
            punch_type: record.punchType,
            client_timestamp: record.clientTimestamp,
            latitude: record.coords?.latitude,
            longitude: record.coords?.longitude,
            accuracy_meters: record.coords?.accuracy,
            is_offline: record.isOffline,
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
