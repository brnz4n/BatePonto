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

  const count = todayPunches.length

  let nextPunchType: PunchType = 'ENTRADA'
  let nextActionDesc = 'Início da sua jornada de trabalho diária'
  let currentWorkStatus: StateMachineResult['currentWorkStatus'] = 'FORA_DE_EXPEDIENTE'

  if (count === 0) {
    nextPunchType = 'ENTRADA'
    nextActionDesc = 'Início da sua jornada de trabalho diária'
    currentWorkStatus = 'FORA_DE_EXPEDIENTE'
  } else if (count === 1) {
    nextPunchType = 'SAIDA_INTERVALO'
    nextActionDesc = 'Início do intervalo intrajornada (almoço/descanso)'
    currentWorkStatus = 'TRABALHANDO'
  } else if (count === 2) {
    nextPunchType = 'RETORNO_INTERVALO'
    nextActionDesc = 'Retorno do intervalo para continuidade da jornada'
    currentWorkStatus = 'EM_INTERVALO'
  } else if (count === 3) {
    nextPunchType = 'SAIDA'
    nextActionDesc = 'Encerramento regular do expediente diário'
    currentWorkStatus = 'TRABALHANDO'
  } else {
    nextPunchType = 'EXTRA'
    nextActionDesc = 'Registro complementar ou extraordinário'
    currentWorkStatus = 'JORNADA_ENCERRADA'
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
