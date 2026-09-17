import { z } from 'zod'

export const punchCoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(5000), // metros
})

export const punchPayloadSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().min(1, 'ID de usuário obrigatório'),
  punchType: z.enum(['ENTRADA', 'SAIDA_INTERVALO', 'RETORNO_INTERVALO', 'SAIDA', 'EXTRA']),
  clientTimestamp: z.string().datetime(),
  performanceNow: z.number().nonnegative(),
  coords: punchCoordinatesSchema.optional(),
  isOffline: z.boolean(),
  auditMetadata: z.record(z.string(), z.any()).optional(),
})

export type ValidatedPunchPayload = z.infer<typeof punchPayloadSchema>
