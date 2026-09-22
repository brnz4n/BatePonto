/**
 * Dados cadastrais do empregador e do REP-P exigidos no cabeçalho do AFD e no comprovante de
 * ponto (Portaria 671/2021 MTE, Art. 79/80). Sem os valores REAIS de registro no INPI/CNPJ
 * abaixo, o arquivo/comprovante gerado NÃO tem validade para fiscalização — preencha via
 * variáveis de ambiente (prefixo VITE_) antes de operar em produção.
 */
export const REP_CONFIG = {
  cnpj: import.meta.env.VITE_COMPANY_CNPJ || '00000000000000',
  razaoSocial: import.meta.env.VITE_COMPANY_RAZAO_SOCIAL || 'RFEITOSA GROUP LTDA',
  endereco: import.meta.env.VITE_COMPANY_ENDERECO || 'ENDERECO NAO CONFIGURADO (defina VITE_COMPANY_ENDERECO)',
  // Registro do fabricante do REP-P no INPI, formato oficial: "BR XX AAAA NNNNNN-D"
  inpiRegistration: import.meta.env.VITE_REP_INPI_REGISTRATION || 'BR 00 0000 000000-0',
}

export const REP_CONFIG_IS_PLACEHOLDER =
  !import.meta.env.VITE_COMPANY_CNPJ || !import.meta.env.VITE_REP_INPI_REGISTRATION
