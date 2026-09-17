import { supabase, isDemoMode } from '../../../shared/lib/supabaseClient'

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

function pad(value: string, length: number): string {
  return value.slice(0, length).padEnd(length, ' ')
}

/**
 * Monta um arquivo no formato ILUSTRATIVO do AFD (Portaria 671/2021 MTE) — prova de conceito de
 * que os dados capturados (NSR sequencial, CPF/PIS, timestamps) atendem ao layout. Não substitui
 * um REP-P homologado para fins de fiscalização real.
 */
export function buildAfdFileContent(rows: AfdRow[]): string {
  const header = `AFD ILUSTRATIVO — NAO VALIDO PARA FISCALIZACAO — GERADO EM ${new Date().toISOString()}`

  const lines = rows.map((row) => {
    const nsr = String(row.nsr).padStart(9, '0')
    const cpf = pad(row.cpf, 11)
    const pis = pad(row.pis || '', 12)
    const timestamp = row.client_timestamp.replace('T', ' ').slice(0, 19)
    const punchType = row.punch_type.padEnd(20, ' ')
    const flag = row.is_out_of_bounds ? 'FORA_PERIMETRO' : ''
    return `3${nsr}${cpf}${pis}${timestamp}${punchType}${flag}`
  })

  return [header, ...lines].join('\n')
}

export function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
