-- ============================================================================
-- Migration 0019 — AI Fitness Coach (Sprint 20)
-- Mevcut ai_conversations / ai_messages KORUNUR ve genişletilir.
-- Yeni: ai_memory, ai_prompt_versions, ai_usage, ai_logs.
-- Additive + idempotent.
-- ============================================================================

-- 1) ai_conversations: arşiv / model / sabitleme --------------------------------
alter table public.ai_conversations
  add column if not exists archived        boolean not null default false,
  add column if not exists pinned          boolean not null default false,
  add column if not exists model           text,
  add column if not exists last_message_at timestamptz;

create index if not exists idx_ai_conv_archived on public.ai_conversations(user_id, archived, updated_at desc);

-- 2) ai_messages: düzenleme / token / model ------------------------------------
alter table public.ai_messages
  add column if not exists edited      boolean not null default false,
  add column if not exists tokens      int,
  add column if not exists model       text,
  add column if not exists updated_at  timestamptz not null default now();

-- 3) ai_memory: kullanıcı başına kalıcı hafıza ---------------------------------
create table if not exists public.ai_memory (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade unique,
  summary    text,                         -- geçmiş konuşmaların özeti
  facts      jsonb not null default '[]',  -- kalıcı gerçekler (hedef, tercih, sakatlık...)
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 4) ai_prompt_versions: sistem promptu sürümleme (admin) ----------------------
create table if not exists public.ai_prompt_versions (
  id         uuid primary key default uuid_generate_v4(),
  key        text not null default 'coach_system',   -- prompt anahtarı
  version    int not null default 1,
  content    text not null,
  is_active  boolean not null default false,
  notes      text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (key, version)
);
create index if not exists idx_ai_prompt_active on public.ai_prompt_versions(key, is_active);

-- 5) ai_usage: token kullanımı -------------------------------------------------
create table if not exists public.ai_usage (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references auth.users(id) on delete set null,
  conversation_id   uuid references public.ai_conversations(id) on delete set null,
  model             text,
  prompt_tokens     int not null default 0,
  completion_tokens int not null default 0,
  total_tokens      int not null default 0,
  created_at        timestamptz not null default now()
);
create index if not exists idx_ai_usage_created on public.ai_usage(created_at desc);
create index if not exists idx_ai_usage_user    on public.ai_usage(user_id, created_at desc);

-- 6) ai_logs: olay/hata logları (admin) ----------------------------------------
create table if not exists public.ai_logs (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete set null,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  level           text not null default 'info',   -- info | warn | error
  event           text not null,
  detail          jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index if not exists idx_ai_logs_created on public.ai_logs(created_at desc);
create index if not exists idx_ai_logs_level    on public.ai_logs(level);

-- 7) profiles: AI veri kullanım izni -------------------------------------------
alter table public.profiles
  add column if not exists ai_consent boolean not null default true,
  add column if not exists sleep_hours_last numeric(3,1);

-- 8) RLS -----------------------------------------------------------------------
alter table public.ai_memory          enable row level security;
alter table public.ai_prompt_versions enable row level security;
alter table public.ai_usage           enable row level security;
alter table public.ai_logs            enable row level security;

-- Hafıza: sahibi yönetir, adminler görür.
drop policy if exists "ai_memory_owner" on public.ai_memory;
create policy "ai_memory_owner" on public.ai_memory
  for all using (auth.uid() = user_id or public.has_admin_access(auth.uid())) with check (auth.uid() = user_id);

-- Prompt sürümleri: herkes aktif olanı okuyabilir (uygulama), admin yazar.
drop policy if exists "ai_prompt_read" on public.ai_prompt_versions;
create policy "ai_prompt_read" on public.ai_prompt_versions for select using (true);
drop policy if exists "ai_prompt_admin_write" on public.ai_prompt_versions;
create policy "ai_prompt_admin_write" on public.ai_prompt_versions
  for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));

-- Kullanım: sahibi kendi kaydını ekler/görür, adminler hepsini görür.
drop policy if exists "ai_usage_access" on public.ai_usage;
create policy "ai_usage_access" on public.ai_usage
  for select using (auth.uid() = user_id or public.has_admin_access(auth.uid()));
drop policy if exists "ai_usage_insert_own" on public.ai_usage;
create policy "ai_usage_insert_own" on public.ai_usage
  for insert with check (auth.uid() = user_id);

-- Loglar: yalnızca admin okur; kullanıcı kendi olayını ekleyebilir.
drop policy if exists "ai_logs_admin_read" on public.ai_logs;
create policy "ai_logs_admin_read" on public.ai_logs
  for select using (public.has_admin_access(auth.uid()));
drop policy if exists "ai_logs_insert_own" on public.ai_logs;
create policy "ai_logs_insert_own" on public.ai_logs
  for insert with check (auth.uid() = user_id or user_id is null);

-- Varsayılan aktif sistem promptu (yoksa) --------------------------------------
insert into public.ai_prompt_versions (key, version, content, is_active, notes)
select 'coach_system', 1,
  'Sen "Viva", Türkçe konuşan, bilimsel temelli ve motive edici bir kişisel fitness ve beslenme koçusun. Önerilerini yalnızca kullanıcının profil ve uygulama verilerine dayandır. Kesin tıbbi teşhis koyma; yaralanma/ağrı durumunda kullanıcıyı bir sağlık profesyoneline yönlendir. Takviye ve ilaç konularında kesin ifadeler kullanma, genel ve bilgilendirici konuş.',
  true, 'Varsayılan sistem promptu (seed)'
where not exists (select 1 from public.ai_prompt_versions where key = 'coach_system');
