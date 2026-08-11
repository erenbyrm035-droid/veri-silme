-- ============================================================================
-- Migration 0022 — Production Hardening (Sprint 10)
-- Kullanıcı ayarları, push token, hata logları, ödeme olayları, hesap silme.
-- Additive + idempotent; mevcut yapıyı bozmaz. Yeni ürün özelliği değil, altyapı.
-- ============================================================================

-- 1) user_settings — profil dışı tercihler (tema/dil/birim/bildirim/gizlilik) --
create table if not exists public.user_settings (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  theme        text not null default 'system',   -- system | light | dark
  locale       text not null default 'tr',        -- tr | en
  units        text not null default 'metric',    -- metric | imperial
  notif_prefs  jsonb not null default '{}',        -- { workout:true, water:true, ... }
  privacy      jsonb not null default '{}',        -- { profile_public:false, leaderboard_visible:true, ... }
  updated_at   timestamptz not null default now()
);

-- 2) push_tokens — FCM cihaz token'ları -------------------------------------
create table if not exists public.push_tokens (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null,
  platform   text not null default 'web',   -- web | ios | android
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (token)
);
create index if not exists idx_push_tokens_user on public.push_tokens (user_id) where active;

-- 3) error_logs — crash reporting / log sistemi -----------------------------
create table if not exists public.error_logs (
  id         uuid primary key default uuid_generate_v4(),
  message    text not null,
  stack      text,
  where_at   text,
  severity   text not null default 'error',  -- info | warning | error | fatal
  user_id    uuid references auth.users(id) on delete set null,
  extra      jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_error_logs_created on public.error_logs (created_at desc);
create index if not exists idx_error_logs_severity on public.error_logs (severity, created_at desc);

-- 4) billing_events — ödeme webhook idempotency + denetim -------------------
create table if not exists public.billing_events (
  id         uuid primary key default uuid_generate_v4(),
  event_id   text not null unique,
  provider   text not null default 'manual',
  type       text not null,
  user_id    uuid references auth.users(id) on delete set null,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_billing_events_user on public.billing_events (user_id, created_at desc);

-- 5) account_deletion_requests — KVKK/GDPR unutulma hakkı -------------------
create table if not exists public.account_deletion_requests (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  reason       text,
  status       text not null default 'pending',  -- pending | processed | canceled
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists idx_deletion_requests_status on public.account_deletion_requests (status, requested_at);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.user_settings              enable row level security;
alter table public.push_tokens                enable row level security;
alter table public.error_logs                 enable row level security;
alter table public.billing_events             enable row level security;
alter table public.account_deletion_requests  enable row level security;

-- user_settings: sahip tam yönetir, admin görür.
drop policy if exists "user_settings_own" on public.user_settings;
create policy "user_settings_own" on public.user_settings
  for all using (auth.uid() = user_id or public.has_admin_access(auth.uid()))
  with check (auth.uid() = user_id or public.has_admin_access(auth.uid()));

-- push_tokens: sahip tam yönetir.
drop policy if exists "push_tokens_own" on public.push_tokens;
create policy "push_tokens_own" on public.push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- error_logs: yalnızca admin okuyabilir (yazma service_role ile).
drop policy if exists "error_logs_admin_read" on public.error_logs;
create policy "error_logs_admin_read" on public.error_logs
  for select using (public.has_admin_access(auth.uid()));

-- billing_events: yalnızca admin okuyabilir (yazma service_role ile).
drop policy if exists "billing_events_admin_read" on public.billing_events;
create policy "billing_events_admin_read" on public.billing_events
  for select using (public.has_admin_access(auth.uid()));

-- account_deletion_requests: sahip oluşturur/görür, admin yönetir.
drop policy if exists "deletion_req_own" on public.account_deletion_requests;
create policy "deletion_req_own" on public.account_deletion_requests
  for select using (auth.uid() = user_id or public.has_admin_access(auth.uid()));
drop policy if exists "deletion_req_insert" on public.account_deletion_requests;
create policy "deletion_req_insert" on public.account_deletion_requests
  for insert with check (auth.uid() = user_id);
drop policy if exists "deletion_req_admin" on public.account_deletion_requests;
create policy "deletion_req_admin" on public.account_deletion_requests
  for update using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));
