import { useState, useEffect, useCallback } from 'react'
import { getTodayPunches } from '../../sync/db/localDb'
import type { LocalPunchRecord, PunchType } from '../types/punch.types'
import { PUNCH_TYPE_LABELS } from '../types/punch.types'

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
  const [todayPunches, setTodayPunches] = useState<LocalPunchRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const refreshTodayPunches = useCallback(async () => {
    try {
      const records = await getTodayPunches(userId)
      setTodayPunches(records)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    refreshTodayPunches()
  }, [refreshTodayPunches])

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
