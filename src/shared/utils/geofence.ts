import { calculateHaversineDistanceKm } from './antiFraud'

/**
 * Sede: R. Rita Marina Moraes de Aquino, 35 - Sobral - CE, 62041-240.
 * Coordenadas obtidas por geocodificação aproximada do CEP (centroide do logradouro),
 * NÃO do número exato do prédio. Antes de usar em produção, capture as coordenadas
 * reais no local (GPS de um celular parado na entrada da sede) e substitua os valores
 * abaixo — um raio de 150m é sensível o suficiente para que o erro do geocoder gere
 * falsos positivos de "fora do perímetro".
 */
export const RFEITOSA_HQ_COORDINATES = {
  latitude: -3.67063013748583,
  longitude: -40.354924826312775,
} as const

export const GEOFENCE_RADIUS_METERS = 150

export interface GeofenceResult {
  distanceMeters: number
  isWithinBounds: boolean
}

/**
 * Calcula a distância (Haversine) entre a posição informada e a sede da RFeitosa Group,
 * retornando se o colaborador está dentro do raio aceitável.
 */
export function checkGeofence(
  latitude: number,
  longitude: number,
  radiusMeters: number = GEOFENCE_RADIUS_METERS
): GeofenceResult {
  const distanceKm = calculateHaversineDistanceKm(
    RFEITOSA_HQ_COORDINATES.latitude,
    RFEITOSA_HQ_COORDINATES.longitude,
    latitude,
    longitude
  )
  const distanceMeters = Math.round(distanceKm * 1000)

  return {
    distanceMeters,
    isWithinBounds: distanceMeters <= radiusMeters,
  }
}
