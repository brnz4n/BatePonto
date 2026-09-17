/**
 * Módulo de Heurísticas Antifraude e Auditoria
 * Conforme estabelecido no DESIGN.md para Soft-Audit (Compliance CLT/Portaria 671)
 */

export interface GeolocationAudit {
  accuracy: number
  isMockSuspect: boolean
  mockReason?: string
  teleportationSuspect?: boolean
  calculatedSpeedKmh?: number
  timeSkewMs: number
}

/**
 * Calcula a distância em quilômetros entre duas coordenadas (Fórmula de Haversine)
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Raio médio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Avalia se houve "teletransporte" (velocidade humana/veicular improvável > 130 km/h)
 */
export function checkVelocityAnomaly(
  prevCoords: { lat: number; lng: number; timestamp: number },
  currentCoords: { lat: number; lng: number; timestamp: number }
): { isAnomaly: boolean; speedKmh: number } {
  const distanceKm = calculateHaversineDistanceKm(
    prevCoords.lat,
    prevCoords.lng,
    currentCoords.lat,
    currentCoords.lng
  )

  const timeDiffHours = (currentCoords.timestamp - prevCoords.timestamp) / (1000 * 60 * 60)

  if (timeDiffHours <= 0) {
    return { isAnomaly: false, speedKmh: 0 }
  }

  const speedKmh = distanceKm / timeDiffHours
  const isAnomaly = speedKmh > 130 // Acima de 130 km/h em perímetro urbano/rodoviário comum

  return { isAnomaly, speedKmh: Math.round(speedKmh * 10) / 10 }
}

/**
 * Detecta indícios de provedores de Mock Location no navegador
 */
export function evaluateMockRisk(coords: GeolocationCoordinates): {
  isMockSuspect: boolean
  reason?: string
} {
  // Suspeita 1: Precisão forçada irrealmente exata (ex: 0m ou 1m cravados em fake GPS)
  if (coords.accuracy <= 1.0) {
    return {
      isMockSuspect: true,
      reason: 'Precisão de GPS artificalmente cravada (≤ 1.0m)',
    }
  }

  // Suspeita 2: Precisão extremamente degradada (ex: > 400m indicando antena/IP muito distante)
  if (coords.accuracy > 400) {
    return {
      isMockSuspect: true,
      reason: 'Precisão de GPS muito baixa (> 400m)',
    }
  }

  return { isMockSuspect: false }
}
