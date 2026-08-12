-- ===========================================================================
-- Migration 0053 — Antrenman analitik olayları
--
-- NE İŞE YARAR: "Kullanıcılar hangi harekette bırakıyor?", "Dinlenme süresi
-- ne kadar atlanıyor?", "Kaç antrenman başlayıp bitmiyor?" sorularının
-- cevabı bu tablodan çıkar. Bugün bu veri hiç toplanmıyor.
--
-- BOYUT: 20 setlik bir antrenman ~50 satır üretir (başlangıç + egzersiz
-- başına + set başına + dinlenme + bitiş). Kullanıcı başına ayda ~1500 satır.
-- Dar bir tablo ve iki indeksle sorun değil.
--
-- Additive + idempotent.
-- ===========================================================================

create table if not exists public.workout_events (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  workout_id  uuid references public.workouts(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  event       text not null,
  -- Olaya özgü ayrıntı: set no, tekrar, ağırlık, dinlenme süresi vb.
  -- Şemayı her yeni alan için değiştirmemek adına jsonb.
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Geçerli olay kümesi. Serbest metin bırakmak, yazım hatası yüzünden
-- ("set_complete" vs "set_completed") ikiye bölünmüş raporlar demekti.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workout_events_event_check') then
    alter table public.workout_events add constraint workout_events_event_check
      check (event in (
        'workout_started', 'exercise_started', 'set_completed', 'set_skipped',
        'rest_started', 'rest_skipped', 'pr_achieved', 'workout_completed'
      ));
  end if;
end $$;

-- Sorgu desenleri: (1) kullanıcının son olayları, (2) bir antrenmanın akışı.
create index if not exists idx_workout_events_user
  on public.workout_events (user_id, created_at desc);
create index if not exists idx_workout_events_workout
  on public.workout_events (workout_id);
create index if not exists idx_workout_events_event
  on public.workout_events (event, created_at desc);

-- --- RLS -------------------------------------------------------------------
-- Kullanıcı YALNIZCA kendi olaylarını yazar ve okur. `with check` olmadan
-- bir kullanıcı başkasının user_id'siyle satır yazabilirdi.
alter table public.workout_events enable row level security;

drop policy if exists "workout_events_own_select" on public.workout_events;
create policy "workout_events_own_select" on public.workout_events
  for select using (auth.uid() = user_id);

drop policy if exists "workout_events_own_insert" on public.workout_events;
create policy "workout_events_own_insert" on public.workout_events
  for insert with check (auth.uid() = user_id);

-- Güncelleme/silme YOK: analitik olayı geçmişin kaydıdır, düzeltilmez.
-- Kullanıcı silinirse cascade ile gider (KVKK veri silme talebi bunu kapsar).

-- --- Admin görünümü --------------------------------------------------------
-- Huni analizi: kaç antrenman başladı, kaçı bitti, hangi olay ne sıklıkta.
create or replace view public.workout_event_funnel as
  select
    event,
    count(*)                                   as toplam,
    count(distinct user_id)                    as kullanici,
    count(distinct workout_id)                 as antrenman,
    date_trunc('day', created_at)::date        as gun
  from public.workout_events
  group by event, date_trunc('day', created_at)::date;

comment on table public.workout_events is
  'Antrenman akışı analitik olayları. Yalnızca ekleme; güncelleme/silme yok.';
