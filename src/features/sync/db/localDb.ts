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
 * Retorna os pontos de um colaborador cujo clientTimestamp cai entre startIso e endIso (inclusive)
 */
export async function getPunchesInRange(userId: string, startIso: string, endIso: string): Promise<LocalPunchRecord[]> {
  return await db.punches
    .where('userId')
    .equals(userId)
    .and((item) => item.clientTimestamp >= startIso && item.clientTimestamp <= endIso)
    .sortBy('clientTimestamp')
}

/**
 * Retorna a contagem de pontos pendentes de sincronização
 */
export async function getPendingPunchesCount(): Promise<number> {
  return await db.punches.where('syncStatus').equals('pending').count()
}

/**
 * Retorna a contagem de pontos que esgotaram as tentativas de sincronização
 */
export async function getFailedPunchesCount(): Promise<number> {
  return await db.punches.where('syncStatus').equals('failed').count()
}

/**
 * Retorna a contagem de pontos pausados por falta de autorização (sessão expirada)
 */
export async function getPausedAuthPunchesCount(): Promise<number> {
  return await db.punches.where('syncStatus').equals('paused_auth').count()
}

/**
 * Devolve os registros 'failed' para a fila de pendentes, zerando o contador de tentativas
 */
export async function retryFailedPunches(): Promise<void> {
  const failedPunches = await db.punches.where('syncStatus').equals('failed').toArray()
  if (failedPunches.length === 0) return

  await db.punches.bulkUpdate(
    failedPunches.map((p) => ({ key: p.id, changes: { syncStatus: 'pending' as const, retryCount: 0 } }))
  )
}

/**
 * Salva o perfil do colaborador no IndexedDB para persistência offline
 */
export async function saveCachedProfile(profile: EmployeeProfile): Promise<void> {
  await db.cachedProfile.put(profile)
}

/**
 * Resgata o perfil do colaborador a partir do IndexedDB
 */
export async function getCachedProfile(userId: string): Promise<EmployeeProfile | undefined> {
  return await db.cachedProfile.get(userId)
}

/**
 * Remove o perfil em cache ao realizar logout
 */
export async function clearCachedProfile(): Promise<void> {
  await db.cachedProfile.clear()
}
