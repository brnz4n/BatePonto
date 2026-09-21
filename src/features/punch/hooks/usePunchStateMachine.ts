import { useState, useEffect, useCallback } from 'react'
import { getPunchesInRange } from '../../sync/db/localDb'
import { fetchRemotePunches, mergePunches } from '../../history/services/historyDataService'
import type { LocalPunchRecord, PunchType } from '../types/punch.types'

// Jornadas noturnas (ex: 22h-06h) atravessam a virada do dia civil. Uma janela fixa de
// 00:00-23:59 zerava a lista de batidas à meia-noite e o app confundia "saída" com "nova
// entrada". Em vez disso, buscamos uma janela deslizante das últimas N horas em tempo
// absoluto — sem depender de meia-noite local nem sofrer o desvio de fuso do toISOString.
const FETCH_WINDOW_HOURS = 24

// Jornada ainda aberta (ENTRADA/SAIDA_INTERVALO/RETORNO_INTERVALO) sem nova batida há mais
// de 16h: o colaborador provavelmente esqueceu de encerrar o turno anterior. Em vez de travar
// a próxima batida como "continuação" daquele turno morto, encerra silenciosamente e libera
// uma nova ENTRADA.
const OPEN_SHIFT_TIMEOUT_HOURS = 16

// Depois de uma SAIDA, o app ainda oferece "Ponto Extra" por um tempo curto (hora extra na
// mesma noite). Um limiar de 16h aqui quebraria o turno diurno comum (ex: saída às 17h,
// entrada do dia seguinte às 8h = só 15h de intervalo) fazendo o app oferecer EXTRA em vez de
// ENTRADA para a nova jornada. Por isso a janela pós-SAIDA é bem mais curta que a de turno aberto.
const POST_SAIDA_EXTRA_WINDOW_HOURS = 4

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

function shiftWindowRangeIso(): { startIso: string; endIso: string } {
  const end = new Date()
  const start = new Date(end.getTime() - FETCH_WINDOW_HOURS * 60 * 60 * 1000)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

// Marcação Sequencial Neutra: em vez de anunciar o tipo dedizido para o banco (ex: "Saída p/
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
  const [windowPunches, setWindowPunches] = useState<LocalPunchRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Mesmo princípio já aplicado no Histórico: o IndexedDB local só é garantido para o que
  // ainda está pendente de sincronizar. Um ponto já sincronizado por OUTRA aba/sessão (ou
  // que sobreviveu a uma limpeza de storage) só existe no Supabase — sem mesclar com o
  // remoto aqui, o card "Registros da Jornada" e o status (em jornada/fora de expediente)
  // ficam divergentes do que o Histórico mostra para o mesmo período.
  const refreshTodayPunches = useCallback(async () => {
    try {
      const { startIso, endIso } = shiftWindowRangeIso()
      const localRecords = await getPunchesInRange(userId, startIso, endIso)
      try {
        const remoteRecords = await fetchRemotePunches(userId, startIso, endIso)
        setWindowPunches(mergePunches(remoteRecords, localRecords))
      } catch {
        setWindowPunches(localRecords)
      }
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    refreshTodayPunches()
  }, [refreshTodayPunches])

  const lastWindowPunch = windowPunches[windowPunches.length - 1]
  const hoursSinceLastPunch = lastWindowPunch
    ? (Date.now() - new Date(lastWindowPunch.clientTimestamp).getTime()) / (1000 * 60 * 60)
    : Infinity
  const isShiftClosed = lastWindowPunch?.punchType === 'SAIDA' || lastWindowPunch?.punchType === 'EXTRA'
  const shiftTimeoutHours = isShiftClosed ? POST_SAIDA_EXTRA_WINDOW_HOURS : OPEN_SHIFT_TIMEOUT_HOURS
  const isShiftExpired = hoursSinceLastPunch >= shiftTimeoutHours

  // Batidas da jornada ainda em curso — usadas tanto para deduzir o próximo passo quanto para
  // exibir a linha do tempo. Uma jornada expirada não "contamina" o novo dia de trabalho.
  const todayPunches = isShiftExpired ? [] : windowPunches

  // Deduz o próximo passo a partir do TIPO da última batida real, não da quantidade de batidas —
  // contar posições (1ª, 2ª, 3ª...) quebra assim que há um ajuste manual fora da sequência padrão
  // (ex: ENTRADA seguida de EXTRA continuaria sendo lida como "2ª batida = volta do intervalo").
  // Isso decide o punchType gravado no banco (compatibilidade com o AFD) — não tem relação com
  // o texto mostrado ao colaborador, que agora é puramente sequencial e neutro.
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
