import { useState, useEffect, useCallback } from 'react'
import { getPunchesInRange } from '../../sync/db/localDb'
import { fetchRemotePunches, mergePunches } from '../../history/services/historyDataService'
import type { LocalPunchRecord, PunchType } from '../types/punch.types'
import { PUNCH_TYPE_LABELS } from '../types/punch.types'

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

function shiftWindowRangeIso(): { startIso: string; endIso: string } {
  const end = new Date()
  const start = new Date(end.getTime() - FETCH_WINDOW_HOURS * 60 * 60 * 1000)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

export interface StateMachineResult {
  todayPunches: LocalPunchRecord[]
  nextPunchType: PunchType
  nextActionLabel: string
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
  const lastPunchType = todayPunches[todayPunches.length - 1]?.punchType

  let nextPunchType: PunchType = 'ENTRADA'
  let nextActionDesc = 'Início da sua jornada de trabalho diária'
  let currentWorkStatus: StateMachineResult['currentWorkStatus'] = 'FORA_DE_EXPEDIENTE'

  switch (lastPunchType) {
    case undefined:
      nextPunchType = 'ENTRADA'
      nextActionDesc = 'Início da sua jornada de trabalho diária'
      currentWorkStatus = 'FORA_DE_EXPEDIENTE'
      break
    case 'ENTRADA':
      nextPunchType = 'SAIDA_INTERVALO'
      nextActionDesc = 'Início do intervalo intrajornada (almoço/descanso)'
      currentWorkStatus = 'TRABALHANDO'
      break
    case 'SAIDA_INTERVALO':
      nextPunchType = 'RETORNO_INTERVALO'
      nextActionDesc = 'Retorno do intervalo para continuidade da jornada'
      currentWorkStatus = 'EM_INTERVALO'
      break
    case 'RETORNO_INTERVALO':
      nextPunchType = 'SAIDA'
      nextActionDesc = 'Encerramento regular do expediente diário'
      currentWorkStatus = 'TRABALHANDO'
      break
    case 'SAIDA':
    case 'EXTRA':
      nextPunchType = 'EXTRA'
      nextActionDesc = 'Registro complementar ou extraordinário'
      currentWorkStatus = 'JORNADA_ENCERRADA'
      break
  }

  const nextActionLabel = PUNCH_TYPE_LABELS[nextPunchType]

  return {
    todayPunches,
    nextPunchType,
    nextActionLabel,
    nextActionDesc,
    currentWorkStatus,
    refreshTodayPunches,
    isLoading,
  }
}
