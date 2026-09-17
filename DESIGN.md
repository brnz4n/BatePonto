# Atlas Ponto — Especificação Técnica e Arquitetura de Design (PWA)

**Projeto:** Atlas Ponto (Módulo do ecossistema Atlas RH)  
**Grupo:** RFeitosa Group  
**Data:** 16/09/2026  
**Status:** Validado e Aprovado para Implementação  

---

## 1. Resumo do Entendimento (Executive Summary)

* **Propósito:** Aplicação PWA (*Progressive Web App*) de registro de ponto eletrônico móvel com fricção zero, eliminando custos recorrentes de soluções terceiras.
* **Ecossistema:** Totalmente integrado ao **Atlas RH**, aproveitando as contas e credenciais já cadastradas no **Hub central**.
* **Público e Dispositivos:** Colaboradores em trânsito ou nas dependências da empresa utilizando smartphones (Safari no iOS e Chrome no Android).
* **UX Central:**
  * **Ação Única:** Tela principal dominada por um relógio digital em tempo real e um **único botão gigante** de cor Vinho Bordô (`#722F37`).
  * **Dedução Automática:** Máquina de estados diária sequencial que infere se a batida é *Entrada*, *Início de Intervalo*, *Retorno de Intervalo*, *Saída* ou *Hora Extra*.
  * **Onboarding A2HS:** Detecção inteligente do navegador (Safari vs Chrome) com modal orientativo de "Adicionar à Tela de Início".
  * **Feedback Imediato:** Confirmação instantânea na UI com check verde animado e gravação local em menos de 100ms.
* **Política Legal e Geográfica:** **Auditoria Não-Bloqueante (Soft-Audit / Compliance CLT)**. O ponto nunca é impedido de ser registrado (evitando passivo sob a Portaria 671 MTE), mas todas as métricas geográficas, precisão e anomalias de fraude são persistidas para conferência do RH.
* **Não-Escopo:** Espelho de ponto complexo, aprovações de banco de horas e relatórios executivos permanecem no painel web desktop do Atlas RH.

---

## 2. Requisitos Não-Funcionais e Premissas (NFRs)

* **Disponibilidade Offline:** 100% de tolerância a falhas de rede. O app armazena batidas no IndexedDB e processa a fila assim que o dispositivo recuperar conectividade.
* **Idempotência:** Batidas recebem identificadores únicos globais (UUID v4) no momento do clique, impedindo registros duplicados no Supabase durante tentativas de sincronização.
* **Integridade de Horário:** Mitigação contra manipulação manual do relógio do celular pelo usuário através do cálculo de *skew* temporal (`time_skew_ms`) contra o relógio atômico do PostgreSQL.
* **Segurança e Isolamento:** Políticas RLS (*Row Level Security*) estritas no Supabase vinculadas a `auth.uid() = user_id`.

---

## 3. Decision Log

| ID | Decisão | Alternativas Consideradas | Motivo da Escolha |
| :--- | :--- | :--- | :--- |
| **D-001** | **Máquina de estados diária sequencial** | Grade horária rígida; Dedução retroativa no backend | Permite deduzir o próximo status (*Entrada -> Intervalo -> Saída*) mesmo sem internet. |
| **D-002** | **Sessão persistente via Supabase Auth** | Token temporário em URL; Login segregado | Evita re-autenticação contínua quando o colaborador abre o app pela tela inicial. |
| **D-003** | **Soft-Audit para geolocalização** | Bloqueio geográfico (Hard-block) | Conformidade legal trabalhista (Portaria 671/2021 MTE / CLT Art. 74). |
| **D-004** | **React + Vite + Tailwind CSS + Dexie (IndexedDB)** | Next.js; Vanilla JS; LocalStorage | Melhor suporte PWA com Workbox e operações ACID locais assíncronas. |
| **D-005** | **Forçamento de GPS de Hardware + Velocity Check** | Geolocation padrão com cache | Reduz em mais de 90% a eficácia de emuladores e apps de *Fake GPS*. |

---

## 4. Arquitetura Front-end (React + Vite PWA)

### 4.1 Identidade Visual (RFeitosa Group)
* **Azul Marinho (`#0A192F` / `#1E293B`):** Cabeçalho, tipografia primária, ícones de navegação e bordas estruturais.
* **Vinho Bordô (`#722F37` / `#881337`):** Botão central de registrar ponto, badges de ação principal e estados ativos.
* **Cinza Claro / Prata (`#F8FAFC` / `#E2E8F0`):** Fundo da aplicação, superfícies de cards e divisórias sutis.

### 4.2 Estrutura Modular de Pastas
```text
src/
├── app/
│   ├── App.tsx                     # Shell da aplicação, temas e provedores
│   ├── routes.tsx                  # Navegação (Tela de Ponto, Histórico Diário)
│   └── main.tsx                    # Bootstrap e registro do Service Worker
├── features/
│   ├── punch/                      # Módulo de Registro de Ponto
│   │   ├── components/
│   │   │   ├── PunchButton.tsx     # Botão central Vinho Bordô com microinterações
│   │   │   ├── LiveClock.tsx       # Relógio digital com precisão por segundo
│   │   │   ├── DailyTimeline.tsx   # Linha do tempo horizontal dos pontos do dia
│   │   │   └── PunchSuccessModal.tsx # Check verde animado e resumo do comprovante
│   │   ├── hooks/
│   │   │   ├── usePunchStateMachine.ts # Máquina de estados da batida diária
│   │   │   └── usePunchAction.ts   # Fluxo de captura, validação Zod e fila
│   │   ├── types/
│   │   │   └── punch.types.ts      # Contratos e enums
│   │   └── schemas/
│   │       └── punch.schema.ts     # Schema Zod para integridade de payload
│   ├── install/                    # Fluxo de Instalação A2HS
│   │   ├── components/
│   │   │   └── InstallGuidanceModal.tsx # Passo a passo visual (iOS Safari / Android)
│   │   └── hooks/
│   │       └── usePWAInstallPrompt.ts # Manipulador do evento beforeinstallprompt
│   └── sync/                       # Sincronização e Fila Offline
│       ├── db/
│       │   └── localDb.ts          # Definição do Dexie.js (IndexedDB)
│       ├── hooks/
│       │   └── useSyncManager.ts   # Observador de conectividade e trigger
│       └── services/
│           └── syncQueueService.ts # Processamento de lote para o Supabase
├── shared/
│   ├── components/                 # Primitivas (Header, Card, Badges)
│   ├── hooks/                      # useGeolocation, useAuthSession
│   ├── lib/                        # supabaseClient, tailwind config
│   └── utils/                      # antiFraud.ts (Haversine, Jitter, Skew)
```

---

## 5. Arquitetura do Banco de Dados (Supabase) & Fila Offline

### 5.1 DDL da Tabela no PostgreSQL
```sql
CREATE TABLE public.time_entries (
    id UUID PRIMARY KEY, -- Gerado no cliente via crypto.randomUUID()
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    punch_type VARCHAR(25) NOT NULL, -- 'ENTRADA', 'SAIDA_INTERVALO', 'RETORNO_INTERVALO', 'SAIDA', 'EXTRA'
    client_timestamp TIMESTAMPTZ NOT NULL, -- Momento do clique no celular
    server_timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), -- Horário atômico do servidor
    time_skew_ms BIGINT GENERATED ALWAYS AS (
        ROUND(EXTRACT(EPOCH FROM (server_timestamp - client_timestamp)) * 1000)
    ) STORED,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    accuracy_meters NUMERIC(8, 2),
    is_offline BOOLEAN NOT NULL DEFAULT false,
    audit_metadata JSONB DEFAULT '{}'::jsonb, -- telemetria, mock flags, IP, user-agent
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Colaborador visualiza seus proprios pontos"
ON public.time_entries FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Colaborador insere seus proprios pontos"
ON public.time_entries FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
```

### 5.2 Fluxo da Fila Local
1. **Gravação Instantânea:** Ao clicar no botão, os dados são salvos na tabela `punches` do IndexedDB com status `pending`.
2. **Confirmação na UI:** A interface dispara o modal verde imediatamente, sem esperar resposta de rede.
3. **Drenagem:** O `syncQueueService` verifica a conexão (`navigator.onLine`). Havendo internet, envia o lote via `upsert` com chave `id`.
4. **Idempotência:** Se houver timeout ou reconexão no meio do envio, reenvios não criam linhas duplicadas.

---

## 6. Estratégias Antifraude e Auditoria

1. **Geolocation de Alta Precisão:**
   * `{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }` forçando uso direto dos satélites GPS.
   * Filtro de precisão: `accuracy_meters > 150m` ou valores redondos suspeitos geram flag de auditoria.
2. **Verificação de Teletransporte (Velocity Check):**
   * Cálculo da velocidade média entre pontos consecutivos com a fórmula de Haversine. Velocidades $> 130\text{ km/h}$ acionam a flag `TELEPORTATION_SUSPECT`.
3. **Auditoria de Desvio de Relógio (Time Drift):**
   * Coleta de `performance.now()` acumulado e verificação de `time_skew_ms > 300000` (5 minutos) no Supabase para identificar alterações no relógio do smartphone.
4. **Triangulação de IP:**
   * Comparação do estado/região do IP de conexão com as coordenadas GPS reportadas no payload.
