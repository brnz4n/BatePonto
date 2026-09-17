export type PunchType =
  | 'ENTRADA'
  | 'SAIDA_INTERVALO'
  | 'RETORNO_INTERVALO'
  | 'SAIDA'
  | 'EXTRA'

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed'

export interface PunchCoordinates {
  latitude: number
  longitude: number
  accuracy: number
}

export interface LocalPunchRecord {
  id: string // UUID v4 gerado no cliente
  userId: string
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
  }
}

export interface EmployeeProfile {
  id: string
  name: string
  role: string
  registrationNumber: string // Matrícula
  department: string
  company: string
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
