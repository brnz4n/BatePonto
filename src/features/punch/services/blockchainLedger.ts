import { db } from '../../sync/db/localDb'
import { sha256Hex } from '../../../shared/utils/sha256'

export interface BlockchainBlock {
  punchId: string
  sequence: number
  previousHash: string
  hash: string
  colaboradorId: string
  punchType: string
  timestampIso: string
  /** String exata que gerou o hash — guardada para permitir reverificação sem repetir input externo. */
  payload: string
  createdAt: string
}

export interface BlockchainHead {
  id: number
  hash: string
  blockCount: number
}

const HEAD_ID = 1
const GENESIS_HASH = '0'.repeat(64)

interface AppendBlockParams {
  punchId: string
  colaboradorId: string
  punchType: string
  timestampIso: string
  coords?: { latitude: number; longitude: number }
}

/**
 * Encadeia um novo bloco ao ledger local (hash chaining / proof of chronology): cada bloco
 * carrega o hash do anterior, então adulterar uma batida passada quebra a cadeia a partir dali.
 * NSR real só existe depois da sincronização (identity column no Postgres) — o encadeamento
 * offline usa o UUID gerado no cliente como identificador estável desde a gravação local.
 */
export async function appendBlock(params: AppendBlockParams): Promise<BlockchainBlock> {
  return db.transaction('rw', db.blockchainHead, db.blockchainBlocks, async () => {
    const head = await db.blockchainHead.get(HEAD_ID)
    const previousHash = head?.hash ?? GENESIS_HASH
    const sequence = (head?.blockCount ?? 0) + 1

    const coordsPart = params.coords
      ? `${params.coords.latitude.toFixed(6)},${params.coords.longitude.toFixed(6)}`
      : 'sem-coordenada'

    const payload = [previousHash, params.punchId, params.colaboradorId, params.timestampIso, params.punchType, coordsPart].join('|')
    const hash = await sha256Hex(payload)

    const block: BlockchainBlock = {
      punchId: params.punchId,
      sequence,
      previousHash,
      hash,
      colaboradorId: params.colaboradorId,
      punchType: params.punchType,
      timestampIso: params.timestampIso,
      payload,
      createdAt: new Date().toISOString(),
    }

    await db.blockchainBlocks.put(block)
    await db.blockchainHead.put({ id: HEAD_ID, hash, blockCount: sequence })

    return block
  })
}

export async function getBlock(punchId: string): Promise<BlockchainBlock | undefined> {
  return db.blockchainBlocks.get(punchId)
}

export interface ChainVerificationResult {
  isValid: boolean
  blockCount: number
  brokenAtSequence?: number
}

/** Reprocessa a cadeia local do zero, recalculando cada hash a partir do payload guardado. */
export async function verifyChain(): Promise<ChainVerificationResult> {
  const blocks = await db.blockchainBlocks.orderBy('sequence').toArray()
  let previousHash = GENESIS_HASH

  for (const block of blocks) {
    const recomputed = await sha256Hex(block.payload)
    const isLinked = block.previousHash === previousHash
    const isHashCorrect = recomputed === block.hash

    if (!isLinked || !isHashCorrect) {
      return { isValid: false, blockCount: blocks.length, brokenAtSequence: block.sequence }
    }

    previousHash = block.hash
  }

  return { isValid: true, blockCount: blocks.length }
}
