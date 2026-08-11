-- ============================================================================
-- Migration 0029 — Onboarding Genişletme
-- Çoklu hedef + genişletilmiş kişisel bilgi alanları.
-- NOT: ALTER TYPE ... ADD VALUE bazı ortamlarda transaction içinde hata
-- verebilir. Hata alırsan önce şu iki satırı TEK BAŞINA çalıştır, sonra gerisini:
--   alter type experience_type  add value if not exists 'professional';
--   alter type environment_type add value if not exists 'outdoor';
-- ============================================================================

-- Yeni enum değerleri (deneyim: Profesyonel, ortam: Açık Alan)
alter type experience_type  add value if not exists 'professional';
alter type environment_type add value if not exists 'outdoor';

-- Yeni profil alanları (hepsi opsiyonel / güvenli varsayılan)
alter table public.profiles
  add column if not exists goals                      text[] not null default '{}',
  add column if not exists birth_date                 date,
  add column if not exists occupation                 text,
  add column if not exists daily_sitting_hours        numeric,
  add column if not exists preferred_workout_duration int,     -- dakika
  add column if not exists water_intake_ml            int,     -- günlük alışkanlık
  add column if not exists smoking_status             text,    -- none | quit | occasional | regular
  add column if not exists health_notes               text;
