# BatePonto (Atlas Ponto)

Aplicação PWA (*Progressive Web App*) de registro de ponto eletrônico móvel com fricção zero, offline-first e compliance CLT (Portaria 671 MTE).

## 🚀 Funcionalidades

- **Ação Única com Dedução Automática:** Máquina de estados diária sequencial que infere o tipo da batida (Entrada, Início de Intervalo, Retorno de Intervalo, Saída, Horas Extras).
- **Offline-First & Sincronização em Segundo Plano:** Gravação instantânea via Dexie.js (IndexedDB) e sincronização automática com Supabase assim que a conexão for restabelecida.
- **Auditoria Não-Bloqueante (Soft-Audit):** Coleta geolocalização e precisão sem impedir o registro do ponto, garantindo total conformidade jurídica.
- **Instalação PWA (A2HS):** Orientação guiada para instalação na tela inicial para iOS (Safari) e Android (Chrome).

## 🛠️ Tecnologias

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4**
- **Dexie.js** (IndexedDB local)
- **Supabase** (Persistência e sincronização em nuvem)
- **Lucide React** (Ícones)
