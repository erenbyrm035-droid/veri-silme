-- ============================================================================
-- Migration 0014 — Kullanıcı Yönetim Sistemi (Sprint 15)
-- Admin panelinde kullanıcı listeleme / detay / premium / rol / ban / not.
-- Tümü additive + idempotent; mevcut yapıyı bozmaz.
-- ============================================================================

-- 1) profiles: yönetim kolonları -------------------------------------------
alter table public.profiles
  add column if not exists is_premium      boolean     not null default false,
  add column if not exists premium_until   timestamptz,
  add column if not exists membership_type  text        not null default 'free',  -- free | premium | trial | lifetime
  add column if not exists is_banned        boolean     not null default false,
  add column if not exists banned_at        timestamptz,
  add column if not exists ban_reason       text,
  add column if not exists is_active        boolean     not null default true,
  add column if not exists phone            text;

-- Süresi geçmiş premium'ları düşürmek için yardımcı (opsiyonel çağrı).
create or replace function public.expire_premiums()
returns void language sql security definer set search_path = public as $$
  update public.profiles
  set is_premium = false, membership_type = 'free'
  where is_premium = true
    and premium_until is not null
    and premium_until < now();
$$;

-- Arama / filtre / sıralama için indexler.
create index if not exists idx_profiles_created_at   on public.profiles (created_at desc);
create index if not exists idx_profiles_is_premium   on public.profiles (is_premium);
create index if not exists idx_profiles_is_banned     on public.profiles (is_banned);
create index if not exists idx_profiles_is_active     on public.profiles (is_active);
create index if not exists idx_profiles_admin_role    on public.profiles (admin_role);
create index if not exists idx_profiles_full_name     on public.profiles (lower(full_name));

-- 2) Admin notları (yalnızca admin görür) ----------------------------------
create table if not exists public.admin_user_notes (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  author_name text,
  note        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_admin_notes_user on public.admin_user_notes (user_id, created_at desc);

-- 3) Giriş olayları (aktivite geçmişi + toplam giriş sayısı) ----------------
create table if not exists public.user_login_events (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  provider    text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_login_events_user on public.user_login_events (user_id, created_at desc);

-- 4) Admin birleşik görünüm (profiles + auth.users) -------------------------
--    E-posta / son giriş gibi alanları tek sorguda getirir.
--    Yalnızca service_role erişebilir (RLS bypass); anon/authenticated'a kapalı.
create or replace view public.admin_users
with (security_invoker = off) as
select
  p.id,
  p.full_name,
  p.avatar_url,
  p.phone,
  p.is_premium,
  p.premium_until,
  p.membership_type,
  p.admin_role,
  p.is_admin,
  p.is_banned,
  p.banned_at,
  p.ban_reason,
  p.is_active,
  p.onboarding_completed,
  p.created_at,
  u.email,
  u.last_sign_in_at,
  u.created_at as registered_at
from public.profiles p
join auth.users u on u.id = p.id;

revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to service_role;

-- 5) RLS ---------------------------------------------------------------------
alter table public.admin_user_notes    enable row level security;
alter table public.user_login_events   enable row level security;

-- Adminler tüm profilleri görebilsin / güncelleyebilsin.
drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all" on public.profiles
  for select using (public.has_admin_access(auth.uid()));

drop policy if exists "profiles_admin_update_all" on public.profiles;
create policy "profiles_admin_update_all" on public.profiles
  for update using (public.has_admin_access(auth.uid()))
  with check (public.has_admin_access(auth.uid()));

-- Admin notları: yalnızca adminler.
drop policy if exists "admin_notes_admin_all" on public.admin_user_notes;
create policy "admin_notes_admin_all" on public.admin_user_notes
  for all using (public.has_admin_access(auth.uid()))
  with check (public.has_admin_access(auth.uid()));

-- Giriş olayları: kullanıcı kendi kaydını ekler, adminler hepsini görür.
drop policy if exists "login_events_insert_own" on public.user_login_events;
create policy "login_events_insert_own" on public.user_login_events
  for insert with check (auth.uid() = user_id);

drop policy if exists "login_events_select_own_or_admin" on public.user_login_events;
create policy "login_events_select_own_or_admin" on public.user_login_events
  for select using (auth.uid() = user_id or public.has_admin_access(auth.uid()));
