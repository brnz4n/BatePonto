import { supabase, isDemoMode } from '../../../shared/lib/supabaseClient'

// Opção 2 (heurística): em vez de exigir que o RH cadastre a grade de horário do colaborador,
// deduzimos o horário habitual a partir do próprio histórico de batidas — funciona para
// qualquer colaborador sem nenhuma configuração prévia.
const LOOKBACK_DAYS = 15
const MIN_SAMPLE_SIZE = 3
// Weekday (0=domingo..6=sábado) considerado "dia de trabalho habitual" só se aparecer pelo
// menos 2 vezes no histórico — evita disparar lembrete num sábado por causa de 1 plantão isolado.
const MIN_WEEKDAY_OCCURRENCES = 2

export const ENTRY_REMINDER_TOLERANCE_MINUTES = 30
export const EXIT_REMINDER_TOLERANCE_MINUTES = 30

export interface ExpectedScheduleHeuristic {
  expectedEntryMinutes: number // minutos desde 00:00, horário local
  expectedExitMinutes: number | null
  workWeekdays: number[] // 0=domingo..6=sábado
}

function timeToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Detecta o horário habitual de entrada/saída e os dias da semana normalmente trabalhados
 * a partir dos últimos 15 dias de batidas no Supabase — sem exigir cadastro prévio de jornada.
 * Retorna null quando não há dados suficientes (colaborador novo, poucas batidas).
 */
export async function detectExpectedSchedule(userId: string): Promise<ExpectedScheduleHeuristic | null> {
  if (isDemoMode) return null

  const since = new Date()
  since.setDate(since.getDate() - LOOKBACK_DAYS)

  const { data, error } = await supabase
    .from('time_entries')
    .select('punch_type, client_timestamp')
    .eq('user_id', userId)
    .in('punch_type', ['ENTRADA', 'SAIDA'])
    .gte('client_timestamp', since.toISOString())
    .order('client_timestamp', { ascending: true })

  if (error || !data || data.length === 0) return null

  const entryDates = data.filter((r) => r.punch_type === 'ENTRADA').map((r) => new Date(r.client_timestamp))
  const exitDates = data.filter((r) => r.punch_type === 'SAIDA').map((r) => new Date(r.client_timestamp))

  if (entryDates.length < MIN_SAMPLE_SIZE) return null

  const weekdayCounts = new Map<number, number>()
  for (const date of entryDates) {
    weekdayCounts.set(date.getDay(), (weekdayCounts.get(date.getDay()) || 0) + 1)
  }
  const workWeekdays = [...weekdayCounts.entries()]
    .filter(([, count]) => count >= MIN_WEEKDAY_OCCURRENCES)
    .map(([weekday]) => weekday)

  return {
    expectedEntryMinutes: median(entryDates.map(timeToMinutes)),
    expectedExitMinutes: exitDates.length >= MIN_SAMPLE_SIZE ? median(exitDates.map(timeToMinutes)) : null,
    workWeekdays,
  }
}
