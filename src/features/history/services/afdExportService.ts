import { supabase, isDemoMode } from '../../../shared/lib/supabaseClient'
import { crc16Hex } from '../../../shared/utils/crc16'
import { buildIso88591File, toIso88591Bytes } from '../../../shared/utils/iso88591'
import { sha256Hex } from '../../../shared/utils/sha256'
import { REP_CONFIG } from '../../../shared/config/repConfig'

interface AfdRow {
  nsr: number
  pis: string | null
  matricula: string
  cpf: string
  client_timestamp: string
  punch_type: string
  is_out_of_bounds: boolean
}

/**
 * Busca as marcações do período em vw_afd_marcacoes. A view roda com security_invoker=true,
 * então a RLS de time_entries/colaboradores já restringe o resultado ao próprio colaborador.
 * Só funciona online — o NSR sequencial é gerado pelo Postgres, não existe cópia local dele.
 */
export async function fetchAfdRows(startIso: string, endIso: string): Promise<AfdRow[]> {
  if (isDemoMode) {
    throw new Error('Exportação de AFD indisponível em modo demo — requer conexão com o Supabase real.')
  }

  const { data, error } = await supabase
    .from('vw_afd_marcacoes')
    .select('nsr, pis, matricula, cpf, client_timestamp, punch_type, is_out_of_bounds')
    .gte('client_timestamp', startIso)
    .lte('client_timestamp', endIso)
    .order('nsr', { ascending: true })

  if (error) throw error
  return (data || []) as AfdRow[]
}

function padLeftZeros(value: string | number, length: number): string {
  return String(value).slice(0, length).padStart(length, '0')
}

function padRightSpaces(value: string, length: number): string {
  return value.slice(0, length).padEnd(length, ' ')
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

// Portaria exige o horário local do registro — os timestamps são gravados em UTC (timestamptz),
// então toda formatação de data/hora do AFD precisa converter explicitamente para Brasília.
const BRASILIA_TZ = 'America/Sao_Paulo'

function brasiliaParts(iso: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRASILIA_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))

  return Object.fromEntries(parts.map((p) => [p.type, p.value]))
}

function toDDMMAAAA(iso: string): string {
  const { day, month, year } = brasiliaParts(iso)
  return `${day}${month}${year}`
}

function toHHMM(iso: string): string {
  const { hour, minute } = brasiliaParts(iso)
  return `${hour}${minute}`
}

// Código interno (não normatizado pela Portaria, uso exclusivo do Atlas Ponto) para diferenciar
// o tipo de marcação sem depender de um campo textual de largura variável no registro Tipo 7.
const PUNCH_TYPE_CODE: Record<string, string> = {
  ENTRADA: '01',
  SAIDA_INTERVALO: '02',
  RETORNO_INTERVALO: '03',
  SAIDA: '04',
  EXTRA: '05',
}

/** Aplica o CRC-16 sobre o corpo (já codificado em ISO-8859-1) e devolve a linha completa com o CRC anexado. */
function withCrc16(bodyIso88591: string): string {
  return bodyIso88591 + crc16Hex(toIso88591Bytes(bodyIso88591))
}

function buildHeaderRecord(startIso: string, endIso: string): string {
  const body =
    '1' +
    padLeftZeros(0, 9) + // NSR do cabeçalho é sempre zeros
    padLeftZeros(onlyDigits(REP_CONFIG.cnpj), 14) +
    padRightSpaces('', 14) + // CEI (não aplicável — MEI/CNPJ único)
    padRightSpaces(REP_CONFIG.razaoSocial.toUpperCase(), 150) +
    padRightSpaces(REP_CONFIG.inpiRegistration.toUpperCase(), 17) +
    toDDMMAAAA(startIso) +
    toDDMMAAAA(endIso) +
    toDDMMAAAA(new Date().toISOString()) +
    toHHMM(new Date().toISOString())

  return withCrc16(body)
}

async function buildMarkingRecord(row: AfdRow): Promise<string> {
  const cpf = padLeftZeros(onlyDigits(row.cpf), 11)
  const nsr = padLeftZeros(row.nsr, 9)
  const data = toDDMMAAAA(row.client_timestamp)
  const hora = toHHMM(row.client_timestamp)
  const tipoCodigo = PUNCH_TYPE_CODE[row.punch_type] || '00'
  const origem = row.is_out_of_bounds ? 'L' : 'O' // fora do perímetro tratado como marcação "local" para conferência do RH

  // Campo 8 — hash SHA-256 da marcação (nsr + cpf + data + hora + tipo), único por registro.
  const hash = await sha256Hex(`${nsr}|${cpf}|${data}|${hora}|${tipoCodigo}`)

  const body = '7' + nsr + cpf + data + hora + tipoCodigo + origem
  return body + hash
}

function buildTrailerRecord(totalHeaderRecords: number, totalMarkingRecords: number, lastNsr: number): string {
  const totalRecords = totalHeaderRecords + totalMarkingRecords + 1 // +1 = o próprio trailer
  const body =
    '9' +
    padLeftZeros(lastNsr + 1, 9) +
    padLeftZeros(totalHeaderRecords, 9) +
    padLeftZeros(totalMarkingRecords, 9) +
    padLeftZeros(totalRecords, 9)

  return withCrc16(body)
}

/**
 * Monta o AFD (Arquivo Fonte de Dados) no layout da Portaria 671/2021 MTE: cabeçalho Tipo 1 e
 * trailer Tipo 9 com CRC-16, registros de marcação Tipo 7 com hash SHA-256 (campo 8), NSR em
 * ordem estrita, largura fixa e saída em bytes ISO-8859-1 com terminação CR+LF.
 *
 * Os POSICIONAMENTOS de campo aqui seguem uma implementação própria, defensável e consistente
 * com os requisitos da Portaria (CRC-16, SHA-256, NSR, ISO-8859-1, CR+LF) — antes de usar este
 * arquivo em uma fiscalização real, valide as posições de campo contra a nota técnica oficial
 * do MTE/INPI para o layout do REP-P.
 */
export async function buildAfdFile(rows: AfdRow[], startIso: string, endIso: string): Promise<Uint8Array> {
  // Ordenação estrita por NSR — a view já ordena, mas o layout exige a garantia aqui também.
  const sortedRows = [...rows].sort((a, b) => a.nsr - b.nsr)

  const header = buildHeaderRecord(startIso, endIso)
  const markingRecords = await Promise.all(sortedRows.map(buildMarkingRecord))
  const lastNsr = sortedRows.length > 0 ? sortedRows[sortedRows.length - 1].nsr : 0
  const trailer = buildTrailerRecord(1, markingRecords.length, lastNsr)

  return buildIso88591File([header, ...markingRecords, trailer])
}

/** Nomenclatura oficial do arquivo: AFDP_{INPI}_{CNPJ}.txt */
export function buildAfdFilename(): string {
  const inpi = onlyDigits(REP_CONFIG.inpiRegistration) || REP_CONFIG.inpiRegistration.replace(/[^A-Z0-9]/gi, '')
  const cnpj = onlyDigits(REP_CONFIG.cnpj)
  return `AFDP_${inpi}_${cnpj}.txt`
}

export function downloadBinaryFile(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'text/plain;charset=iso-8859-1' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
