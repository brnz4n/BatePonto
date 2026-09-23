import { useState, useEffect, useMemo, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { FileDown, FileText, Loader2, AlertCircle, History as HistoryIcon, CheckCircle2, Clock, CloudOff } from 'lucide-react'
import { getPunchesInRange } from '../../sync/db/localDb'
import { fetchAfdRows, buildAfdFile, buildAfdFilename, downloadBinaryFile } from '../services/afdExportService'
import { fetchRemotePunches, mergePunches } from '../services/historyDataService'
import { generatePunchReceiptPdf } from '../../punch/services/punchReceiptService'
import { PUNCH_TYPE_SHORT } from '../../punch/types/punch.types'
import type { LocalPunchRecord } from '../../punch/types/punch.types'
import type { AuthenticatedContext } from '../../../app/AuthenticatedLayout'
import { monthRange } from '../../../shared/utils/dateRange'

const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

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
  const [receiptGeneratingId, setReceiptGeneratingId] = useState<string | null>(null)
  const [receiptError, setReceiptError] = useState<string | null>(null)

  const { startIso, endIso } = useMemo(() => monthRange(year, month), [year, month])

  // Exibição do mais recente para o mais antigo — a busca/merge continua em ordem
  // cronológica (usada pelo export AFD), a inversão é só para a lista na tela.
  const displayedPunches = useMemo(() => [...punches].reverse(), [punches])

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
      const fileBytes = await buildAfdFile(rows, startIso, endIso)
      downloadBinaryFile(fileBytes, buildAfdFilename())
    } catch (err: any) {
      setExportError(err?.message || 'Não foi possível gerar o arquivo AFD.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadReceipt = async (punch: LocalPunchRecord) => {
    setReceiptError(null)
    setReceiptGeneratingId(punch.id)
    try {
      await generatePunchReceiptPdf(punch, profile)
    } catch (err: any) {
      setReceiptError(err?.message || 'Não foi possível gerar o comprovante em PDF.')
    } finally {
      setReceiptGeneratingId(null)
    }
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[#212965]">
        <HistoryIcon className="w-4.5 h-4.5 text-[#6d0001]" />
        <h1 className="text-base font-bold">Histórico de Pontos</h1>
      </div>

      {loadNotice && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
          <CloudOff className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{loadNotice}</span>
        </div>
      )}

      {/* Filtros de Mês e Ano */}
      <div className="flex gap-2">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="flex-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#212965] focus:outline-none focus:border-[#6d0001]"
        >
          {MONTH_LABELS.map((label, index) => (
            <option key={label} value={index}>{label}</option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-28 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#212965] focus:outline-none focus:border-[#6d0001]"
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
          className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 text-[#212965] font-semibold rounded-xl text-sm transition-all cursor-pointer shadow-sm"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 text-[#6d0001]" />}
          Gerar Arquivo AFD
        </button>

        {exportError && (
          <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{exportError}</span>
          </div>
        )}

        <p className="mt-1.5 text-[10px] text-[#727272] leading-relaxed">
          Layout Tipo 1/7/9 (CRC-16, SHA-256, ISO-8859-1) da Portaria 671/2021 — valide as posições de campo com o RH antes de uso em fiscalização real.
        </p>
      </div>

      {receiptError && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{receiptError}</span>
        </div>
      )}

      {/* Lista de Registros do Período */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-[#212965]">
            {MONTH_LABELS[month]} de {year}
          </h2>
          <span className="text-xs font-mono text-[#727272]">
            {punches.length} {punches.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-[#727272]">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : punches.length === 0 ? (
          <div className="text-center py-8 text-[#727272] text-xs px-4">
            Nenhuma batida registrada neste período (neste dispositivo).
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {displayedPunches.map((punch) => {
              const date = new Date(punch.clientTimestamp)
              const dateFormatted = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
              const timeFormatted = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              const isSynced = punch.syncStatus === 'synced'
              const isOutOfBounds = punch.auditMetadata?.isOutOfBounds

              return (
                <div key={punch.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <span className="text-xs font-semibold text-[#212965] block">
                      {PUNCH_TYPE_SHORT[punch.punchType] || punch.punchType}
                    </span>
                    <span className="text-[10px] text-[#727272] font-mono">
                      {dateFormatted} às {timeFormatted}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isOutOfBounds && (
                      <span
                        title="Registrado fora do raio da sede"
                        className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200"
                      >
                        Fora da sede
                      </span>
                    )}
                    {isSynced ? (
                      <span title="Sincronizado"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /></span>
                    ) : (
                      <span title="Aguardando sincronização"><Clock className="w-3.5 h-3.5 text-amber-600" /></span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDownloadReceipt(punch)}
                      disabled={receiptGeneratingId === punch.id}
                      title="Baixar comprovante em PDF"
                      aria-label="Baixar comprovante em PDF"
                      className="p-1.5 text-[#727272] hover:text-[#6d0001] disabled:opacity-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      {receiptGeneratingId === punch.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                    </button>
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
