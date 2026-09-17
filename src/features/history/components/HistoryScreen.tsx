import { useState, useEffect, useMemo, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { FileDown, Loader2, AlertCircle, History as HistoryIcon, CheckCircle2, Clock, CloudOff } from 'lucide-react'
import { getPunchesInRange } from '../../sync/db/localDb'
import { fetchAfdRows, buildAfdFileContent, downloadTextFile } from '../services/afdExportService'
import { fetchRemotePunches, mergePunches } from '../services/historyDataService'
import { PUNCH_TYPE_SHORT } from '../../punch/types/punch.types'
import type { LocalPunchRecord } from '../../punch/types/punch.types'
import type { AuthenticatedContext } from '../../../app/AuthenticatedLayout'

const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function monthRange(year: number, month: number): { startIso: string; endIso: string } {
  const start = new Date(year, month, 1, 0, 0, 0, 0)
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

export function HistoryScreen() {
  const { profile, syncManager } = useOutletContext<AuthenticatedContext>()
  const now = new Date()

  const [month, setMonth] = useState<number>(now.getMonth())
  const [year, setYear] = useState<number>(now.getFullYear())
  const [punches, setPunches] = useState<LocalPunchRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [loadNotice, setLoadNotice] = useState<string | null>(null)

  const { startIso, endIso } = useMemo(() => monthRange(year, month), [year, month])

  const loadPunches = useCallback(async () => {
    setIsLoading(true)
    setLoadNotice(null)

    // O IndexedDB local só guarda "hoje" e o que ainda não sincronizou — o Supabase é a
    // fonte da verdade pro histórico completo. Sem isso, trocar de aparelho/URL de preview
    // ou perder o IndexedDB local (ITP do Safari, etc.) faz parecer que os pontos sumiram.
    const localRecords = await getPunchesInRange(profile.id, startIso, endIso)
    try {
      const remoteRecords = await fetchRemotePunches(profile.id, startIso, endIso)
      setPunches(mergePunches(remoteRecords, localRecords))
    } catch {
      setLoadNotice('Sem conexão com o servidor agora — mostrando só o que está salvo neste dispositivo.')
      setPunches(localRecords)
    } finally {
      setIsLoading(false)
    }
  }, [profile.id, startIso, endIso])

  useEffect(() => {
    loadPunches()
  }, [loadPunches])

  const handleExportAfd = async () => {
    setExportError(null)
    setIsExporting(true)
    try {
      const rows = await fetchAfdRows(startIso, endIso)
      if (rows.length === 0) {
        setExportError('Nenhuma marcação sincronizada nesse período ainda.')
        return
      }
      const content = buildAfdFileContent(rows)
      downloadTextFile(content, `afd_${profile.registrationNumber}_${year}-${String(month + 1).padStart(2, '0')}.txt`)
    } catch (err: any) {
      setExportError(err?.message || 'Não foi possível gerar o arquivo AFD.')
    } finally {
      setIsExporting(false)
    }
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-slate-200">
        <HistoryIcon className="w-4.5 h-4.5 text-[#c25b68]" />
        <h1 className="text-base font-bold">Histórico de Pontos</h1>
      </div>

      {loadNotice && (
        <div className="p-2.5 bg-amber-950/60 border border-amber-800/80 rounded-xl text-xs text-amber-200 flex items-center gap-2">
          <CloudOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{loadNotice}</span>
        </div>
      )}

      {/* Filtros de Mês e Ano */}
      <div className="flex gap-2">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="flex-1 px-3 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-[#8C3843]"
        >
          {MONTH_LABELS.map((label, index) => (
            <option key={label} value={index}>{label}</option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-28 px-3 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-[#8C3843]"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Botão de Exportação do AFD */}
      <div>
        <button
          onClick={handleExportAfd}
          disabled={isExporting || !syncManager.isOnline}
          title={!syncManager.isOnline ? 'Requer conexão com a internet' : 'Gera um arquivo ilustrativo no formato AFD'}
          className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-750 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 text-slate-200 font-semibold rounded-xl text-sm transition-all cursor-pointer"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 text-[#c25b68]" />}
          Gerar Arquivo AFD
        </button>

        {exportError && (
          <div className="mt-2 p-2.5 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{exportError}</span>
          </div>
        )}

        <p className="mt-1.5 text-[10px] text-slate-500 leading-relaxed">
          Arquivo ilustrativo para demonstração — não substitui um REP-P homologado para fiscalização.
        </p>
      </div>

      {/* Lista de Registros do Período */}
      <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800/80 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
          <h2 className="text-sm font-semibold text-slate-200">
            {MONTH_LABELS[month]} de {year}
          </h2>
          <span className="text-xs font-mono text-slate-400">
            {punches.length} {punches.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : punches.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs px-4">
            Nenhuma batida registrada neste período (neste dispositivo).
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {punches.map((punch) => {
              const date = new Date(punch.clientTimestamp)
              const dateFormatted = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
              const timeFormatted = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              const isSynced = punch.syncStatus === 'synced'
              const isOutOfBounds = punch.auditMetadata?.isOutOfBounds

              return (
                <div key={punch.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">
                      {PUNCH_TYPE_SHORT[punch.punchType] || punch.punchType}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {dateFormatted} às {timeFormatted}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isOutOfBounds && (
                      <span
                        title="Registrado fora do raio da sede"
                        className="text-[10px] text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded-md border border-amber-800/40"
                      >
                        Fora da sede
                      </span>
                    )}
                    {isSynced ? (
                      <span title="Sincronizado"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /></span>
                    ) : (
                      <span title="Aguardando sincronização"><Clock className="w-3.5 h-3.5 text-amber-400" /></span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
