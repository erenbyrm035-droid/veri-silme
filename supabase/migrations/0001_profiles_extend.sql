-- ============================================================================
-- Migration 0001 — profiles genişletme (Sprint 1)
-- Onboarding'e eklenen alanlar: yağ oranı, uyku, su, sakatlık, ekipman.
-- Not: schema.sql yeni kurulumlar için güncel; bu migration mevcut
-- veritabanlarını ileri taşımak içindir. Idempotent (IF NOT EXISTS).
-- ============================================================================

alter table public.profiles
  add column if not exists body_fat_pct        numeric(4,1) check (body_fat_pct between 3 and 70),
  add column if not exists sleep_hours          numeric(3,1) check (sleep_hours between 0 and 24),
  add column if not exists injuries             text[] not null default '{}',
  add column if not exists available_equipment  text[] not null default '{}';

comment on column public.profiles.body_fat_pct is 'Tahmini vücut yağ oranı (%)';
comment on column public.profiles.injuries is 'Sakatlık geçmişi etiketleri (örn. diz, bel, omuz)';
comment on column public.profiles.available_equipment is 'Erişilebilir ekipman kodları (dumbbell, barbell, ...)';
