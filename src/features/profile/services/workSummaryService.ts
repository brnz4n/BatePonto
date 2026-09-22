import { getPunchesInRange } from '../../sync/db/localDb'
import { fetchRemotePunches, mergePunches } from '../../history/services/historyDataService'
import { monthRange } from '../../../shared/utils/dateRange'
import type { LocalPunchRecord } from '../../punch/types/punch.types'

export interface MonthlyWorkSummary {
  workedMinutes: number
  workedHoursLabel: string
  daysWorked: number
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

// Marcação Sequencial Neutra (mesmo princípio de usePunchStateMachine.ts): a posição da batida
// no dia é que importa, não o tipo gravado. Intervalos de índice par (1ª→2ª, 3ª→4ª...) são
// jornada trabalhada; os ímpares (2ª→3ª...) são pausa/fim de expediente e não entram na soma.
// Uma última batida sem par (jornada ainda aberta) não é contada — é só uma estimativa.
function computeDayWorkedMinutes(dayPunches: LocalPunchRecord[]): number {
  const sorted = [...dayPunches].sort((a, b) => a.clientTimestamp.localeCompare(b.clientTimestamp))
  let minutes = 0
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    const start = new Date(sorted[i].clientTimestamp).getTime()
    const end = new Date(sorted[i + 1].clientTimestamp).getTime()
    minutes += Math.max(0, (end - start) / 60000)
  }
  return minutes
}

function formatHoursLabel(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)
  return minutes > 0 ? `${hours}h${String(minutes).padStart(2, '0')}` : `${hours}h`
}

/** Estimativa de horas trabalhadas e dias com jornada fechada no mês — não substitui o cálculo oficial de folha. */
export async function computeMonthlySummary(userId: string, year: number, month: number): Promise<MonthlyWorkSummary> {
  const { startIso, endIso } = monthRange(year, month)

  const localRecords = await getPunchesInRange(userId, startIso, endIso)
  let punches: LocalPunchRecord[]
  try {
    const remoteRecords = await fetchRemotePunches(userId, startIso, endIso)
    punches = mergePunches(remoteRecords, localRecords)
  } catch {
    punches = localRecords
  }

  const byDay = new Map<string, LocalPunchRecord[]>()
  for (const punch of punches) {
    const key = dayKey(punch.clientTimestamp)
    const list = byDay.get(key)
    if (list) {
      list.push(punch)
    } else {
      byDay.set(key, [punch])
    }
  }

  let totalMinutes = 0
  let daysWorked = 0
  for (const dayPunches of byDay.values()) {
    const minutes = computeDayWorkedMinutes(dayPunches)
    if (minutes > 0) daysWorked += 1
    totalMinutes += minutes
  }

  return { workedMinutes: totalMinutes, workedHoursLabel: formatHoursLabel(totalMinutes), daysWorked }
}
