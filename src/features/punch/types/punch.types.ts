export type PunchType =
  | 'ENTRADA'
  | 'SAIDA_INTERVALO'
  | 'RETORNO_INTERVALO'
  | 'SAIDA'
  | 'EXTRA'

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'paused_auth'

export interface PunchCoordinates {
  latitude: number
  longitude: number
  accuracy: number
}

export interface LocalPunchRecord {
  id: string // UUID v4 gerado no cliente
  userId: string
  colaboradorId: string // FK para colaboradores.id — necessário para popular vw_afd_marcacoes
  punchType: PunchType
  clientTimestamp: string // ISO 8601 string
  performanceNow: number // Relógio monotônico do navegador
  coords?: PunchCoordinates
  isOffline: boolean
  syncStatus: SyncStatus
  retryCount: number
  syncedAt?: string
  auditMetadata?: {
    isMockSuspect?: boolean
    mockReason?: string
    teleportationSuspect?: boolean
    calculatedSpeedKmh?: number
    userAgent?: string
    isManualOverride?: boolean
    originalDeducedType?: PunchType
    justification?: string
    geoError?: string
    isOutOfBounds?: boolean
    distanceFromHqMeters?: number
  }
}

export interface EmployeeProfile {
  id: string // auth.users.id — usado como time_entries.user_id (RLS: auth.uid() = user_id)
  colaboradorId: string // colaboradores.id — usado como time_entries.colaborador_id (AFD)
  name: string
  role: string
  registrationNumber: string // Matrícula
  department: string
  company: string
  email: string
  isFirstLogin: boolean
}

export const PUNCH_TYPE_LABELS: Record<PunchType, string> = {
  ENTRADA: 'Registrar Entrada',
  SAIDA_INTERVALO: 'Saída p/ Almoço',
  RETORNO_INTERVALO: 'Retorno do Almoço',
  SAIDA: 'Registrar Saída',
  EXTRA: 'Registrar Ponto Extra',
}

export const PUNCH_TYPE_SHORT: Record<PunchType, string> = {
  ENTRADA: 'Entrada',
  SAIDA_INTERVALO: 'Almoço (Saída)',
  RETORNO_INTERVALO: 'Almoço (Volta)',
  SAIDA: 'Saída',
  EXTRA: 'Ponto Extra',
}
