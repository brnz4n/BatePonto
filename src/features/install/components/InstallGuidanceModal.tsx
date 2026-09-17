import React, { useState, useEffect } from 'react'
import { Share, PlusSquare, MoreVertical, Download, X, Smartphone } from 'lucide-react'
import { usePWAInstallPrompt } from '../hooks/usePWAInstallPrompt'

interface InstallGuidanceModalProps {
  forceOpen?: boolean
  onClose?: () => void
}

export const InstallGuidanceModal: React.FC<InstallGuidanceModalProps> = ({
  forceOpen = false,
  onClose,
}) => {
  const { isStandalone, isIos, isAndroid, canPromptNative, promptToInstall } = usePWAInstallPrompt()
  const [isOpen, setIsOpen] = useState<boolean>(false)

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true)
      return
    }

    // Se já estiver em modo standalone (app instalado), não exibe o modal de onboarding
    if (isStandalone) {
      setIsOpen(false)
      return
    }

    // Verifica se já foi dispensado nesta sessão
    const dismissed = sessionStorage.getItem('atlas_install_prompt_dismissed')
    if (!dismissed) {
      // Abre sutilmente após 1.5s de carga
      const timer = setTimeout(() => setIsOpen(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [isStandalone, forceOpen])

  const handleClose = () => {
    sessionStorage.setItem('atlas_install_prompt_dismissed', 'true')
    setIsOpen(false)
    if (onClose) onClose()
  }

  const handleInstallClick = async () => {
    if (canPromptNative) {
      await promptToInstall()
      handleClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-750 rounded-3xl p-6 shadow-2xl text-left overflow-hidden">
        {/* Luz de destaque decorativa */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#722F37]/30 blur-2xl rounded-full pointer-events-none" />

        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#722F37] to-[#0A192F] border border-slate-700 flex items-center justify-center shadow-lg">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h4 className="text-base font-bold text-white leading-tight">Instalar o Atlas Ponto</h4>
            <span className="text-xs text-[#c25b68] font-medium">Acesso rápido em 1 toque</span>
          </div>
        </div>

        <p className="text-xs text-slate-300 mb-5 leading-relaxed">
          Instale o PWA na sua tela inicial para bater o ponto mesmo sem internet e com a mesma agilidade de um app nativo.
        </p>

        {/* Guia Visual específico para iOS Safari */}
        {isIos && (
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3 mb-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <span className="w-5 h-5 rounded-full bg-[#722F37] text-white flex items-center justify-center text-[10px]">
                1
              </span>
              <span>Toque no botão de Compartilhar</span>
              <Share className="w-4 h-4 text-sky-400 ml-auto" />
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <span className="w-5 h-5 rounded-full bg-[#722F37] text-white flex items-center justify-center text-[10px]">
                2
              </span>
              <span>Selecione "Adicionar à Tela de Início"</span>
              <PlusSquare className="w-4 h-4 text-emerald-400 ml-auto" />
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <span className="w-5 h-5 rounded-full bg-[#722F37] text-white flex items-center justify-center text-[10px]">
                3
              </span>
              <span>Toque em "Adicionar" no topo direito</span>
            </div>
          </div>
        )}

        {/* Guia Visual específico para Android Chrome */}
        {isAndroid && (
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3 mb-5">
            {canPromptNative ? (
              <p className="text-xs text-slate-300">
                Toque no botão abaixo para adicionar o app automaticamente ao seu celular.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <span className="w-5 h-5 rounded-full bg-[#722F37] text-white flex items-center justify-center text-[10px]">
                    1
                  </span>
                  <span>Toque nos 3 pontos no topo do Chrome</span>
                  <MoreVertical className="w-4 h-4 text-slate-300 ml-auto" />
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <span className="w-5 h-5 rounded-full bg-[#722F37] text-white flex items-center justify-center text-[10px]">
                    2
                  </span>
                  <span>Selecione "Instalar aplicativo" ou "Adicionar à tela inicial"</span>
                  <Download className="w-4 h-4 text-emerald-400 ml-auto" />
                </div>
              </>
            )}
          </div>
        )}

        {/* Caso seja Desktop ou navegador genérico */}
        {!isIos && !isAndroid && (
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 text-xs text-slate-300 mb-5">
            Para a melhor experiência, abra o link no seu smartphone ou clique no ícone de instalação na barra do navegador.
          </div>
        )}

        <div className="flex gap-2.5">
          {canPromptNative && isAndroid ? (
            <button
              onClick={handleInstallClick}
              className="flex-1 py-3 bg-[#722F37] hover:bg-[#8C3843] text-white font-semibold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Instalar Agora</span>
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="flex-1 py-3 bg-[#722F37] hover:bg-[#8C3843] text-white font-semibold rounded-xl text-sm transition-all shadow-md text-center"
            >
              Entendido
            </button>
          )}

          <button
            onClick={handleClose}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-medium rounded-xl text-xs transition-all"
          >
            Depois
          </button>
        </div>
      </div>
    </div>
  )
}
