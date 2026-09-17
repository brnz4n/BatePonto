import Dexie, { type Table } from 'dexie'
import type { LocalPunchRecord, EmployeeProfile } from '../../punch/types/punch.types'

export class AtlasPontoDatabase extends Dexie {
  punches!: Table<LocalPunchRecord, string>
  cachedProfile!: Table<EmployeeProfile, string>

  constructor() {
    super('AtlasPontoDB')
    this.version(1).stores({
      punches: 'id, userId, punchType, clientTimestamp, syncStatus, isOffline',
      cachedProfile: 'id, name, registrationNumber',
    })
  }
}

export const db = new AtlasPontoDatabase()

/**
 * Retorna os pontos batidos no dia atual (baseado na data local YYYY-MM-DD)
 */
export async function getTodayPunches(userId: string): Promise<LocalPunchRecord[]> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const startIso = startOfDay.toISOString()

  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)
  const endIso = endOfDay.toISOString()

  const records = await db.punches
    .where('userId')
    .equals(userId)
    .and((item) => item.clientTimestamp >= startIso && item.clientTimestamp <= endIso)
    .sortBy('clientTimestamp')

  return records
}

/**
 * Retorna a contagem de pontos pendentes de sincronização
 */
export async function getPendingPunchesCount(): Promise<number> {
  return await db.punches.where('syncStatus').equals('pending').count()
}
