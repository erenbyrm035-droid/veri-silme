-- ============================================================================
-- Migration 0025 — Exercise Media Set (Profesyonel Medya Yönetimi)
-- Egzersiz başına konsolide medya kaydı: thumbnail/gif/video + cinsiyet
-- varyantları + otomatik durum. Mevcut çok-satırlı exercise_media (galeri)
-- tablosu KORUNUR; bu tablo per-egzersiz ana medya kaydıdır.
-- Additive + idempotent; mevcut Exercise CMS'i bozmaz.
-- ============================================================================

create table if not exists public.exercise_media_set (
  id            uuid primary key default uuid_generate_v4(),
  exercise_id   uuid not null unique references public.exercises(id) on delete cascade,
  thumbnail_url text,
  gif_url       text,
  video_url     text,
  male_gif      text,
  female_gif    text,
  male_video    text,
  female_video  text,
  status        text not null default 'none',   -- complete | partial | none (trigger ile)
  updated_at    timestamptz not null default now()
);
create index if not exists idx_exercise_media_set_status on public.exercise_media_set (status);

-- Durum otomasyonu: her insert/update'te medya alanlarından hesaplanır.
create or replace function public.set_exercise_media_status()
returns trigger language plpgsql as $$
declare has_gif boolean; has_video boolean; has_thumb boolean; any_media boolean;
begin
  has_gif   := coalesce(new.gif_url,'') <> '' or (coalesce(new.male_gif,'') <> '' and coalesce(new.female_gif,'') <> '');
  has_video := coalesce(new.video_url,'') <> '' or (coalesce(new.male_video,'') <> '' and coalesce(new.female_video,'') <> '');
  has_thumb := coalesce(new.thumbnail_url,'') <> '';
  any_media := has_thumb or has_gif or has_video
    or coalesce(new.gif_url,'') <> '' or coalesce(new.video_url,'') <> ''
    or coalesce(new.male_gif,'') <> '' or coalesce(new.female_gif,'') <> ''
    or coalesce(new.male_video,'') <> '' or coalesce(new.female_video,'') <> '';
  if not any_media then new.status := 'none';
  elsif has_thumb and has_gif and has_video then new.status := 'complete';
  else new.status := 'partial';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_exercise_media_status on public.exercise_media_set;
create trigger trg_exercise_media_status
  before insert or update on public.exercise_media_set
  for each row execute function public.set_exercise_media_status();

-- RLS: herkes okur (uygulama medyayı gösterir), yalnızca admin yazar.
alter table public.exercise_media_set enable row level security;

drop policy if exists "exercise_media_set_read" on public.exercise_media_set;
create policy "exercise_media_set_read" on public.exercise_media_set
  for select using (auth.role() = 'authenticated');

drop policy if exists "exercise_media_set_admin_write" on public.exercise_media_set;
create policy "exercise_media_set_admin_write" on public.exercise_media_set
  for all using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));

-- exercise-media bucket zaten public (migration 0012). CDN URL:
--   <SUPABASE_URL>/storage/v1/object/public/exercise-media/<path>
-- İleride AI ile üretilen medya da aynı sütunlara (gif_url/video_url/...) bağlanır.
