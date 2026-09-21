import { useState, useCallback } from 'react'
import { evaluateMockRisk } from '../utils/antiFraud'
import type { PunchCoordinates } from '../../features/punch/types/punch.types'

export interface GeolocationState {
  coords: PunchCoordinates | null
  isMockSuspect: boolean
  mockReason?: string
  error: string | null
  isLoading: boolean
  fetchedAt: number | null
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    coords: null,
    isMockSuspect: false,
    error: null,
    isLoading: false,
    fetchedAt: null,
  })

  const getPosition = useCallback(async (): Promise<{
    coords?: PunchCoordinates
    isMockSuspect: boolean
    mockReason?: string
    error?: string
  }> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    if (!navigator.geolocation) {
      const errorMsg = 'Geolocalização não suportada neste navegador'
      setState({ coords: null, isMockSuspect: false, error: errorMsg, isLoading: false, fetchedAt: null })
      return { isMockSuspect: false, error: errorMsg }
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords
          const mockCheck = evaluateMockRisk(position.coords)

          const coords: PunchCoordinates = {
            latitude: Math.round(latitude * 1e7) / 1e7,
            longitude: Math.round(longitude * 1e7) / 1e7,
            accuracy: Math.round(accuracy * 10) / 10,
          }

          setState({
            coords,
            isMockSuspect: mockCheck.isMockSuspect,
            mockReason: mockCheck.reason,
            error: null,
            isLoading: false,
            fetchedAt: Date.now(),
          })

          resolve({
            coords,
            isMockSuspect: mockCheck.isMockSuspect,
            mockReason: mockCheck.reason,
          })
        },
        (error) => {
          let errorMsg = 'Não foi possível obter a localização'
          if (error.code === error.PERMISSION_DENIED) {
            errorMsg = 'Permissão de localização negada pelo usuário'
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errorMsg = 'Sinal de GPS indisponível no momento'
          } else if (error.code === error.TIMEOUT) {
            errorMsg = 'Tempo esgotado ao buscar sinal de satélite'
          }

          setState({
            coords: null,
            isMockSuspect: false,
            error: errorMsg,
            isLoading: false,
            fetchedAt: null,
          })

          resolve({
            isMockSuspect: false,
            error: errorMsg,
          })
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      )
    })
  }, [])

  return {
    ...state,
    getPosition,
  }
}
