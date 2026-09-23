import { useState, useEffect, useCallback } from 'react'
import { getPunchesInRange } from '../../sync/db/localDb'
import { fetchRemotePunches, mergePunches } from '../../history/services/historyDataService'
import type { LocalPunchRecord, PunchType } from '../types/punch.types'

/**
 * Retorna o intervalo do dia civil local (00:00:00.000 até 23:59:59.999).
 * Como a empresa opera exclusivamente em horário diurno comercial (sem turnos noturnos
 * que viram a meia-noite), cada novo dia civil é uma jornada limpa que reseta à meia-noite.
 * Usar a data local do navegador com getFullYear/getMonth/getDate evita o desvio de fuso
 * do toISOString() (onde meia-noite no Brasil UTC-3 viraria 03:00Z em UTC).
 */
function todayLocalRangeIso(): { startIso: string; endIso: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

// A 2ª batida do dia é sempre gravada como SAIDA_INTERVALO por compatibilidade com o banco
// (ver Marcação Sequencial Neutra abaixo), mas só é plausível tratá-la como "saída para o
// almoço" — badge "Em Intervalo" + cronômetro de almoço — se ela realmente aconteceu num
// horário de almoço. Sem essa checagem, um colaborador que bate só 2 pontos no dia (entrada de
// manhã, saída às 18h direto pra casa) via badge e cronômetro de almoço errados.
const LUNCH_WINDOW_START_MINUTES = 11 * 60 // 11:00
const LUNCH_WINDOW_END_MINUTES = 15 * 60 + 30 // 15:30

function isWithinLunchWindow(clientTimestamp: string): boolean {
  const date = new Date(clientTimestamp)
  const minutesOfDay = date.getHours() * 60 + date.getMinutes()
  return minutesOfDay >= LUNCH_WINDOW_START_MINUTES && minutesOfDay <= LUNCH_WINDOW_END_MINUTES
}

// Marcação Sequencial Neutra: em vez de anunciar o tipo deduzido para o banco (ex: "Saída p/
// Almoço"), o colaborador só vê a posição da próxima batida na jornada. Isso evita atrito
// quando o tipo técnico não bate com a realidade (ex: esqueceu o intervalo e a 2ª marcação do
// dia, tecnicamente SAIDA_INTERVALO, é na real o fim do expediente).
const SEQUENTIAL_ACTION_DESCRIPTIONS: Record<number, string> = {
  1: '1º registro do dia • Início da jornada',
  2: '2º registro do dia',
  3: '3º registro do dia',
  4: '4º registro do dia • Encerramento regular',
}

export interface StateMachineResult {
  todayPunches: LocalPunchRecord[]
  nextPunchType: PunchType
  nextActionDesc: string
  currentWorkStatus: 'FORA_DE_EXPEDIENTE' | 'TRABALHANDO' | 'EM_INTERVALO' | 'JORNADA_ENCERRADA'
  refreshTodayPunches: () => Promise<void>
  isLoading: boolean
}

export function usePunchStateMachine(userId: string): StateMachineResult {
  const [todayPunches, setTodayPunches] = useState<LocalPunchRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Mesmo princípio já aplicado no Histórico: o IndexedDB local só é garantido para o que
  // ainda está pendente de sincronizar. Um ponto já sincronizado por OUTRA aba/sessão (ou
  // que sobreviveu a uma limpeza de storage) só existe no Supabase — sem mesclar com o
  // remoto aqui, o card "Registros do Dia" e o status (em jornada/fora de expediente)
  // ficam divergentes do que o Histórico mostra para o mesmo período.
  const refreshTodayPunches = useCallback(async () => {
    try {
      const { startIso, endIso } = todayLocalRangeIso()
      const localRecords = await getPunchesInRange(userId, startIso, endIso)
      try {
        const remoteRecords = await fetchRemotePunches(userId, startIso, endIso)
        setTodayPunches(mergePunches(remoteRecords, localRecords))
      } catch {
        setTodayPunches(localRecords)
      }
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    refreshTodayPunches()
  }, [refreshTodayPunches])

  // Deduz o próximo passo a partir do TIPO da última batida real do dia, não da quantidade —
  // contar posições (1ª, 2ª, 3ª...) quebra assim que há um ajuste manual fora da sequência padrão.
  // Isso decide o punchType gravado no banco (compatibilidade com o AFD) — não tem relação com
  // o texto mostrado ao colaborador, que é puramente sequencial e neutro.
  const lastPunch = todayPunches[todayPunches.length - 1]
  const lastPunchType = lastPunch?.punchType

  let nextPunchType: PunchType = 'ENTRADA'
  let currentWorkStatus: StateMachineResult['currentWorkStatus'] = 'FORA_DE_EXPEDIENTE'

  switch (lastPunchType) {
    case undefined:
      nextPunchType = 'ENTRADA'
      currentWorkStatus = 'FORA_DE_EXPEDIENTE'
      break
    case 'ENTRADA':
      nextPunchType = 'SAIDA_INTERVALO'
      currentWorkStatus = 'TRABALHANDO'
      break
    case 'SAIDA_INTERVALO':
      nextPunchType = 'RETORNO_INTERVALO'
      currentWorkStatus =
        lastPunch && isWithinLunchWindow(lastPunch.clientTimestamp) ? 'EM_INTERVALO' : 'JORNADA_ENCERRADA'
      break
    case 'RETORNO_INTERVALO':
      nextPunchType = 'SAIDA'
      currentWorkStatus = 'TRABALHANDO'
      break
    case 'SAIDA':
    case 'EXTRA':
      nextPunchType = 'EXTRA'
      currentWorkStatus = 'JORNADA_ENCERRADA'
      break
  }

  const upcomingPunchNumber = todayPunches.length + 1
  const nextActionDesc = SEQUENTIAL_ACTION_DESCRIPTIONS[upcomingPunchNumber] || 'Registro complementar'

  return {
    todayPunches,
    nextPunchType,
    nextActionDesc,
    currentWorkStatus,
    refreshTodayPunches,
    isLoading,
  }
}
