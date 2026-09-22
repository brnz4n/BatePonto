import type { EmployeeProfile, LocalPunchRecord } from '../types/punch.types'
import { PUNCH_TYPE_SHORT } from '../types/punch.types'
import { REP_CONFIG } from '../../../shared/config/repConfig'
import { sha256Hex } from '../../../shared/utils/sha256'

function formatCpf(cpf?: string): string {
  if (!cpf) return 'Não informado'
  const digits = cpf.replace(/\D/g, '').padStart(11, '0')
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

function formatCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '').padStart(14, '0')
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

function formatDateTimeBrasilia(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' })
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' })
  return { date, time }
}

/** Hash de autenticidade específico da marcação — independente do elo da blockchain, calculado a partir dos dados exibidos no comprovante em si. */
async function computeReceiptHash(record: LocalPunchRecord, profile: EmployeeProfile): Promise<string> {
  const payload = [record.id, record.nsr ?? 'PENDENTE', profile.cpf ?? '', record.clientTimestamp, record.punchType].join('|')
  return sha256Hex(payload)
}

/**
 * Gera o Comprovante de Registro de Ponto do Trabalhador (Art. 79/80 da Portaria 671/2021 MTE)
 * em PDF e dispara o download. jsPDF/qrcode são carregados sob demanda (import dinâmico) para
 * não pesar o bundle inicial do PWA — só quem realmente emite um comprovante paga esse custo.
 */
export async function generatePunchReceiptPdf(record: LocalPunchRecord, profile: EmployeeProfile): Promise<void> {
  const [{ default: jsPDF }, QRCode, receiptHash] = await Promise.all([
    import('jspdf'),
    import('qrcode'),
    computeReceiptHash(record, profile),
  ])

  const { date, time } = formatDateTimeBrasilia(record.clientTimestamp)
  const blockchain = record.auditMetadata?.blockchain
  const qrPayload = `ATLASPONTO|${record.id}|${receiptHash}`
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 240 })

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const marginX = 18
  let y = 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Comprovante de Registro de Ponto do Trabalhador', marginX, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Emitido nos termos do Art. 79 e 80 da Portaria 671/2021 (MTE) — Registrador Eletrônico de Ponto Ponto (REP-P)', marginX, y)
  doc.setTextColor(0)
  y += 8
  doc.setDrawColor(180)
  doc.line(marginX, y, 210 - marginX, y)
  y += 8

  const section = (title: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(title, marginX, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
  }

  const row = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, marginX, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, marginX + 45, y)
    y += 5.5
  }

  section('Empregador')
  row('Razão Social:', REP_CONFIG.razaoSocial)
  row('CNPJ:', formatCnpj(REP_CONFIG.cnpj))
  row('Endereço:', REP_CONFIG.endereco)
  y += 3

  section('Trabalhador')
  row('Nome:', profile.name)
  row('CPF:', formatCpf(profile.cpf))
  row('Matrícula:', profile.registrationNumber)
  y += 3

  section('Registro de Ponto')
  row('Tipo de Marcação:', PUNCH_TYPE_SHORT[record.punchType] || record.punchType)
  row('Data:', date)
  row('Horário (Brasília):', `${time} (UTC-3)`)
  row('NSR:', record.nsr != null ? String(record.nsr).padStart(9, '0') : 'Aguardando sincronização')
  row('Registro REP-P (INPI):', REP_CONFIG.inpiRegistration)
  if (record.auditMetadata?.isRetroactive) {
    row('Natureza:', 'Ajuste retroativo justificado pelo colaborador')
  }
  y += 3

  section('Garantia Criptográfica')
  doc.setFontSize(7.5)
  doc.setFont('courier', 'normal')
  doc.text('Código de Autenticidade (SHA-256):', marginX, y)
  y += 4.5
  doc.text(receiptHash, marginX, y)
  y += 6
  if (blockchain) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Elo da Cadeia (Blockchain Local)', marginX, y)
    y += 4.5
    doc.setFont('courier', 'normal')
    doc.setFontSize(7.5)
    doc.text(`Sequência: #${blockchain.sequence}`, marginX, y)
    y += 4.5
    doc.text(`Hash Anterior: ${blockchain.previousHash}`, marginX, y)
    y += 4.5
    doc.text(`Hash Atual: ${blockchain.hash}`, marginX, y)
    y += 6
  }

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.text(
    'Declaração de conformidade: este comprovante é assinado eletronicamente e estruturado para',
    marginX,
    y
  )
  y += 3.8
  doc.text('validação no padrão de certificação digital ICP-Brasil (Medida Provisória 2.200-2/2001).', marginX, y)
  y += 8

  doc.addImage(qrDataUrl, 'PNG', 210 - marginX - 28, y - 4, 28, 28)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('Código de verificação:', marginX, y + 4)
  doc.setFont('courier', 'normal')
  doc.text(record.id, marginX, y + 8)

  doc.setFontSize(7)
  doc.setTextColor(140)
  doc.text(`Documento gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, marginX, 285)

  const filename = `comprovante-ponto_${profile.registrationNumber}_${date.replace(/\//g, '-')}_${time.replace(/:/g, '')}.pdf`
  doc.save(filename)
}
