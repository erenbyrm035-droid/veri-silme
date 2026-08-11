-- ============================================================================
-- Migration 0008 — Authentication & Onboarding geliştirmesi
-- Yeni hedef (Güç) + ortam (Her ikisi) + Google avatar + trigger güncelleme.
-- Mevcut yapıyı bozmaz. Not: ALTER TYPE ADD VALUE ayrı çalıştırılmalı;
-- bu dosya bunları başta, kullanımdan önce ekler.
-- ============================================================================

-- Yeni enum değerleri (idempotent)
alter type goal_type        add value if not exists 'gain_strength';
alter type environment_type add value if not exists 'both';

-- Profile: Google/Apple avatar
alter table public.profiles
  add column if not exists avatar_url text;

-- Yeni kullanıcı → profil: ad + avatar'ı sağlayıcı meta verisinden al
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      ''
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  )
  on conflict (id) do nothing;
  return new;
end $$;
