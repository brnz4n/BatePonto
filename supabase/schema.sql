-- ============================================================================
-- Atlas Ponto — Script de Setup do Banco (MVP)
-- Execute no SQL Editor do Supabase, na ordem em que as seções aparecem.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1) COLABORADORES
-- Hoje é a fonte da verdade (provisionada manualmente pelo RH). Quando a
-- integração com o Hub Atlas RH existir, esta tabela passa a ser alimentada
-- por sincronização em vez de INSERT manual — mas o formato de `auth_user_id`
-- + `email` como chave de login permanece o mesmo.
-- ============================================================================
create table public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  nome text not null,
  matricula text not null unique,
  cpf text not null unique,
  pis text, -- obrigatório para a linha tipo 2 do AFD (Portaria 671/2021 MTE)
  email text not null unique, -- e-mail corporativo Locaweb, usado no login
  cargo text,
  departamento text,
  empresa text not null default 'RFeitosa Group',
  is_first_login boolean not null default true, -- força troca de senha provisória no 1º acesso
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.colaboradores enable row level security;

-- Um colaborador autenticado só consegue ler/atualizar a própria linha —
-- necessário para o app checar `is_first_login` e zerá-lo após a troca de senha.
create policy "colaborador le seu proprio cadastro"
  on public.colaboradores for select to authenticated
  using (auth.uid() = auth_user_id);

create policy "colaborador atualiza seu proprio cadastro"
  on public.colaboradores for update to authenticated
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

-- ============================================================================
-- 2) REGISTROS DE PONTO (nome mantido: time_entries, já usado pelo client)
-- ============================================================================
create table public.time_entries (
  id uuid primary key, -- gerado no cliente via crypto.randomUUID() (idempotência)
  nsr bigint generated always as identity, -- Número Sequencial de Registro exigido no AFD
  user_id uuid not null references auth.users(id) on delete restrict,
  colaborador_id uuid references public.colaboradores(id) on delete restrict,
  punch_type varchar(25) not null check (punch_type in ('ENTRADA','SAIDA_INTERVALO','RETORNO_INTERVALO','SAIDA','EXTRA')),
  client_timestamp timestamptz not null,
  server_timestamp timestamptz not null default clock_timestamp(),
  time_skew_ms bigint generated always as (
    round(extract(epoch from (server_timestamp - client_timestamp)) * 1000)
  ) stored,
  latitude numeric(10,7),
  longitude numeric(10,7),
  accuracy_meters numeric(8,2),
  is_offline boolean not null default false,
  -- Geofencing: preenchido no client (src/shared/utils/geofence.ts). Nunca bloqueia o registro
  -- (soft-audit) — só sinaliza para conferência do RH quando o colaborador bateu ponto fora do raio.
  is_out_of_bounds boolean not null default false,
  distance_from_hq_meters numeric(8,2),
  audit_metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_time_entries_colaborador_periodo
  on public.time_entries (colaborador_id, client_timestamp);

create index idx_time_entries_out_of_bounds
  on public.time_entries (is_out_of_bounds)
  where is_out_of_bounds = true;

alter table public.time_entries enable row level security;

create policy "colaborador ve seus proprios pontos"
  on public.time_entries for select to authenticated
  using (auth.uid() = user_id);

create policy "colaborador insere seus proprios pontos"
  on public.time_entries for insert to authenticated
  with check (auth.uid() = user_id);

-- ============================================================================
-- 3) VIEW DE APOIO PARA O EXPORT DO AFD
-- O client (afdExportService.ts) monta as linhas de largura fixa a partir
-- desta view — mantém a lógica de formatação fora do banco.
-- ============================================================================
create view public.vw_afd_marcacoes
  with (security_invoker = true) -- sem isso a view roda com o dono (bypassa a RLS de time_entries)
as
select
  te.nsr,
  c.pis,
  c.matricula,
  c.cpf,
  te.client_timestamp,
  te.punch_type,
  te.is_out_of_bounds
from public.time_entries te
join public.colaboradores c on c.id = te.colaborador_id
order by te.nsr;

-- ============================================================================
-- 4) USUÁRIO ADMIN (SETUP INICIAL)
--
-- JÁ EXECUTADO em 2026-09-17 diretamente no projeto Supabase "BatePonto" via
-- MCP (auth.users + auth.identities + colaboradores, com is_first_login=true,
-- então a senha provisória é obrigatoriamente trocada no primeiro login). A
-- senha em texto puro foi removida deste arquivo depois de aplicada — não a
-- reintroduza aqui. Modelo abaixo para provisionar outra conta do mesmo jeito
-- (troque email/cpf/senha e rode manualmente no SQL Editor):
--
-- ATENÇÃO: inserir direto em `auth.users`/`auth.identities` não é a via
-- oficial do Supabase (o schema interno da GoTrue pode mudar entre versões).
-- Prefira o Dashboard (Authentication → Add User) ou a Admin API quando não
-- for só para a demo.
--
-- PEGADINHA JÁ SOFRIDA (17/09): os tokens abaixo (confirmation_token,
-- recovery_token, email_change*, phone_change*, reauthentication_token) têm
-- DEFAULT NULL na tabela, mas a GoTrue espera string vazia — com NULL o
-- login por senha falha com um erro genérico. Por isso o insert força ''
-- explicitamente em todos eles, não confie no default da coluna.
-- ============================================================================
-- do $$
-- declare
--   novo_user_id uuid := gen_random_uuid();
-- begin
--   insert into auth.users (
--     instance_id, id, aud, role, email, encrypted_password,
--     email_confirmed_at, created_at, updated_at,
--     raw_app_meta_data, raw_user_meta_data, is_super_admin,
--     confirmation_token, recovery_token, email_change, email_change_token_new,
--     email_change_token_current, phone_change, phone_change_token, reauthentication_token
--   ) values (
--     '00000000-0000-0000-0000-000000000000',
--     novo_user_id, 'authenticated', 'authenticated',
--     '<email>', crypt('<senha-provisoria>', gen_salt('bf')),
--     now(), now(), now(),
--     '{"provider":"email","providers":["email"]}', '{}', false,
--     '', '', '', '', '', '', '', ''
--   );
--
--   insert into auth.identities (
--     id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
--   ) values (
--     gen_random_uuid(), novo_user_id, novo_user_id::text,
--     jsonb_build_object('sub', novo_user_id::text, 'email', '<email>'),
--     'email', now(), now(), now()
--   );
--
--   insert into public.colaboradores (
--     auth_user_id, nome, matricula, cpf, email, cargo, departamento, is_first_login
--   ) values (
--     novo_user_id, '<nome>', '<matricula>', '<cpf>', '<email>', '<cargo>', '<departamento>', true
--   );
-- end $$;

-- ============================================================================
-- 5) COLABORADORES DE EXEMPLO (opcional, para a demo com o supervisor)
-- Sem `auth_user_id` — vinculado apenas quando o RH criar o login de fato.
-- ============================================================================
insert into public.colaboradores (nome, matricula, cpf, pis, email, cargo, departamento)
values
  ('Maria Souza', 'RF-1050', '11111111111', '98765432100', 'maria.souza@rfeitosagroup.com.br', 'Analista de RH', 'Recursos Humanos');
