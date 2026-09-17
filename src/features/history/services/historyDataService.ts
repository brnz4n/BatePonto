import { supabase, isDemoMode } from '../../../shared/lib/supabaseClient'
import type { LocalPunchRecord, PunchType } from '../../punch/types/punch.types'

interface RemoteTimeEntryRow {
  id: string
  user_id: string
  colaborador_id: string | null
  punch_type: string
  client_timestamp: string
  latitude: number | null
  longitude: number | null
  accuracy_meters: number | null
  is_offline: boolean
  is_out_of_bounds: boolean
  distance_from_hq_meters: number | null
  audit_metadata: Record<string, any> | null
}

function toLocalPunchRecord(row: RemoteTimeEntryRow): LocalPunchRecord {
  return {
    id: row.id,
    userId: row.user_id,
    colaboradorId: row.colaborador_id || '',
    punchType: row.punch_type as PunchType,
    clientTimestamp: row.client_timestamp,
    performanceNow: 0,
    coords:
      row.latitude != null && row.longitude != null
        ? { latitude: row.latitude, longitude: row.longitude, accuracy: row.accuracy_meters ?? 0 }
        : undefined,
    isOffline: row.is_offline,
    syncStatus: 'synced',
    retryCount: 0,
    auditMetadata: {
      ...(row.audit_metadata || {}),
      isOutOfBounds: row.is_out_of_bounds,
      distanceFromHqMeters: row.distance_from_hq_meters ?? undefined,
    },
  }
}

/**
 * Supabase é a fonte da verdade para o histórico — o IndexedDB local é só um cache de
 * "hoje"/pendências. Sem isso, trocar de dispositivo ou perder o IndexedDB (ITP do Safari,
 * troca de URL de preview, etc.) faz parecer que os pontos sumiram, quando na verdade só
 * não tinham sido lidos de onde realmente ficam guardados.
 */
export async function fetchRemotePunches(userId: string, startIso: string, endIso: string): Promise<LocalPunchRecord[]> {
  if (isDemoMode) return []

  const { data, error } = await supabase
    .from('time_entries')
    .select(
      'id, user_id, colaborador_id, punch_type, client_timestamp, latitude, longitude, accuracy_meters, is_offline, is_out_of_bounds, distance_from_hq_meters, audit_metadata'
    )
    .eq('user_id', userId)
    .gte('client_timestamp', startIso)
    .lte('client_timestamp', endIso)
    .order('client_timestamp', { ascending: true })

  if (error) throw error
  return (data || []).map(toLocalPunchRecord)
}

/** Combina remoto (sincronizado) com local (pendente/offline), sem duplicar por id — remoto prevalece. */
export function mergePunches(remote: LocalPunchRecord[], local: LocalPunchRecord[]): LocalPunchRecord[] {
  const byId = new Map<string, LocalPunchRecord>()
  for (const record of local) byId.set(record.id, record)
  for (const record of remote) byId.set(record.id, record)
  return Array.from(byId.values()).sort((a, b) => a.clientTimestamp.localeCompare(b.clientTimestamp))
}
