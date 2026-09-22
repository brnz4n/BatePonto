import { db } from '../../sync/db/localDb'
import { appendBlock } from '../../punch/services/blockchainLedger'
import { punchPayloadSchema } from '../../punch/schemas/punch.schema'
import type { LocalPunchRecord, PunchType } from '../../punch/types/punch.types'

interface CreateRetroactivePunchParams {
  userId: string
  colaboradorId: string
  punchType: PunchType
  /** Combinação de data (YYYY-MM-DD) + hora (HH:MM) escolhidas pelo colaborador, já em horário local. */
  dateIso: string
  justification: string
}

/**
 * Cria um registro de ponto retroativo (data/hora escolhida pelo colaborador, não "agora").
 * Diferente da batida ao vivo, aqui não há GPS/antifraude de velocidade para checar — a
 * auditoria fica por conta da justificativa obrigatória e do selo `isRetroactive` no metadata.
 */
export async function createRetroactivePunch(params: CreateRetroactivePunchParams): Promise<LocalPunchRecord> {
  const trimmedJustification = params.justification.trim()
  if (trimmedJustification.length < 5) {
    throw new Error('Descreva o motivo do esquecimento com pelo menos 5 caracteres.')
  }

  const targetDate = new Date(params.dateIso)
  if (Number.isNaN(targetDate.getTime())) {
    throw new Error('Data e hora inválidas.')
  }
  if (targetDate.getTime() > Date.now()) {
    throw new Error('Não é possível justificar um ponto em uma data/hora futura.')
  }

  const punchId = crypto.randomUUID()
  const clientIso = targetDate.toISOString()

  const rawPayload = {
    id: punchId,
    userId: params.userId,
    colaboradorId: params.colaboradorId,
    punchType: params.punchType,
    clientTimestamp: clientIso,
    performanceNow: performance.now(),
    isOffline: !navigator.onLine,
    auditMetadata: {
      userAgent: navigator.userAgent,
      isManualOverride: true,
      isRetroactive: true,
      justification: trimmedJustification,
    },
  }

  const validation = punchPayloadSchema.safeParse(rawPayload)
  if (!validation.success) {
    throw new Error(`Dados inválidos para o ajuste: ${validation.error.issues[0]?.message}`)
  }

  const record: LocalPunchRecord = {
    ...rawPayload,
    syncStatus: 'pending',
    retryCount: 0,
  }

  await db.punches.add(record)

  const block = await appendBlock({
    punchId,
    colaboradorId: params.colaboradorId,
    punchType: params.punchType,
    timestampIso: clientIso,
  })
  record.auditMetadata = {
    ...record.auditMetadata,
    blockchain: { hash: block.hash, previousHash: block.previousHash, sequence: block.sequence },
  }
  await db.punches.update(punchId, { auditMetadata: record.auditMetadata })

  return record
}
