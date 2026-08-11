-- ============================================================================
-- Migration 0020 — Uygulama Ayarları + eksik modül tamamlama (Sprint 21)
-- app_settings: anahtar-değer ayar deposu (AI, özellik bayrakları, site).
-- Additive + idempotent.
-- ============================================================================

create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null default '{}',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Varsayılan ayarlar (yoksa).
insert into public.app_settings (key, value) values
  ('ai',       '{"provider":"openai","max_tokens":900,"temperature":0.7}'),
  ('features', '{"ai_coach":true,"posture":true,"nutrition":true,"programs":true}'),
  ('site',     '{"maintenance":false,"registration_open":true,"support_email":"destek@viva.app"}')
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

-- Herkes okuyabilir (özellik bayrakları uygulamada gerekir); yalnızca admin yazar.
drop policy if exists "app_settings_read" on public.app_settings;
create policy "app_settings_read" on public.app_settings for select using (true);
drop policy if exists "app_settings_admin_write" on public.app_settings;
create policy "app_settings_admin_write" on public.app_settings
  for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));
