-- ============================================================================
-- Migration 0039 — Takımlar: Sosyal Katman
--
-- 0038'in üzerine eklenir; hiçbir mevcut tablo/politika kaldırılmaz.
--   • Arkadaşlık + takip sistemi
--   • Online durumu / son görülme (presence)
--   • Birlikte antrenman (canlı oturumlar)
--   • Otomatik aktivite akışı (antrenman, başarım, seri, seviye)
--   • 30 günlük istatistik serisi + takım nabzı
--   • Sohbet medyası için storage bucket
--   • Genişletilmiş Realtime yayını
--
-- Additive + idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Arkadaşlık
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
  id           uuid primary key default uuid_generate_v4(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending',   -- pending | accepted | declined | blocked
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);
create index if not exists idx_friendships_req  on public.friendships (requester_id, status);
create index if not exists idx_friendships_addr on public.friendships (addressee_id, status);

-- Takip (tek yönlü, onay gerekmez)
create table if not exists public.follows (
  follower_id  uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);
create index if not exists idx_follows_following on public.follows (following_id);

/** İki kullanıcı arkadaş mı? (yön bağımsız) */
create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = p_a and f.addressee_id = p_b)
        or (f.requester_id = p_b and f.addressee_id = p_a))
  );
$$;

/** Kullanıcının kabul edilmiş arkadaşlarının kimlikleri. */
create or replace function public.friend_ids(p_user uuid)
returns table (user_id uuid) language sql stable security definer set search_path = public as $$
  select case when f.requester_id = p_user then f.addressee_id else f.requester_id end
  from public.friendships f
  where f.status = 'accepted' and (f.requester_id = p_user or f.addressee_id = p_user);
$$;

-- ---------------------------------------------------------------------------
-- 2) Presence — online durumu / son görülme
--    Kalp atışı (heartbeat) ile güncellenir; 2 dakikadan eskiyse çevrimdışı.
-- ---------------------------------------------------------------------------
create table if not exists public.user_presence (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  status       text not null default 'online',    -- online | training | away | offline
  activity     text,                               -- "Göğüs & Triceps" gibi serbest metin
  team_id      uuid references public.teams(id) on delete set null,
  last_seen_at timestamptz not null default now()
);
create index if not exists idx_presence_team on public.user_presence (team_id, last_seen_at desc);

/** Kalp atışı: presence satırını yazar/günceller. */
create or replace function public.touch_presence(
  p_status text default 'online',
  p_activity text default null,
  p_team uuid default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_presence (user_id, status, activity, team_id, last_seen_at)
  values (auth.uid(), coalesce(p_status, 'online'), p_activity, p_team, now())
  on conflict (user_id) do update
    set status = excluded.status,
        activity = coalesce(excluded.activity, public.user_presence.activity),
        team_id = coalesce(excluded.team_id, public.user_presence.team_id),
        last_seen_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- 3) Birlikte antrenman — canlı oturumlar
-- ---------------------------------------------------------------------------
create table if not exists public.team_live_sessions (
  id         uuid primary key default uuid_generate_v4(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  host_id    uuid references auth.users(id) on delete set null,
  title      text not null default 'Birlikte Antrenman',
  status     text not null default 'live',       -- live | ended
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  total_xp   int not null default 0
);
create index if not exists idx_live_sessions_team on public.team_live_sessions (team_id, status, started_at desc);

create table if not exists public.team_live_participants (
  id           uuid primary key default uuid_generate_v4(),
  session_id   uuid not null references public.team_live_sessions(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  left_at      timestamptz,
  duration_sec int not null default 0,
  xp_earned    int not null default 0,
  unique (session_id, user_id)
);
create index if not exists idx_live_parts_session on public.team_live_participants (session_id);

/** Oturumu bitirir: süreleri hesaplar, bonus XP dağıtır, akışa düşer. */
create or replace function public.end_live_session(p_session uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  s record; v_count int; v_bonus int; v_total int := 0; v_names text;
begin
  select * into s from public.team_live_sessions where id = p_session;
  if not found or s.status = 'ended' then return 0; end if;

  update public.team_live_participants p
     set left_at = coalesce(p.left_at, now()),
         duration_sec = greatest(0, extract(epoch from (coalesce(p.left_at, now()) - p.joined_at))::int)
   where p.session_id = p_session;

  select count(*) into v_count from public.team_live_participants where session_id = p_session;
  -- Birlikte antrenman bonusu: katılımcı başına 25 XP + her ek kişi için %10
  v_bonus := greatest(0, 25 + (v_count - 1) * 3);

  update public.team_live_participants set xp_earned = v_bonus where session_id = p_session;
  v_total := v_bonus * coalesce(v_count, 0);

  update public.team_live_sessions
     set status = 'ended', ended_at = now(), total_xp = v_total
   where id = p_session;

  select string_agg(coalesce(pr.full_name, 'Sporcu'), ', ')
    into v_names
    from public.team_live_participants lp
    join public.profiles pr on pr.id = lp.user_id
   where lp.session_id = p_session;

  insert into public.team_posts (team_id, user_id, kind, body, meta, is_system)
  values (
    s.team_id, s.host_id, 'live_workout',
    coalesce(v_names, 'Takım') || ' birlikte antrenmanı tamamladı!',
    jsonb_build_object('participants', v_count, 'bonus_xp', v_bonus, 'total_xp', v_total,
                       'minutes', greatest(1, extract(epoch from (now() - s.started_at))::int / 60)),
    true
  );

  -- Bonus XP: xp_logs üzerinden (leaderboard_scores bu kayıtları toplar).
  -- Alt blokta tutulur ki olası bir hata oturumun kapanmasını geri almasın.
  begin
    insert into public.xp_logs (user_id, event_key, xp, ref_type, ref_id, meta)
    select lp.user_id, 'team_live_workout', v_bonus, 'team_live_session', p_session,
           jsonb_build_object('team', s.team_id)
      from public.team_live_participants lp
     where lp.session_id = p_session;
  exception when others then
    null;
  end;

  return v_total;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Otomatik aktivite akışı
--    Aynı olayın iki kez düşmemesi için meta içinde kaynak kimliği tutulur.
-- ---------------------------------------------------------------------------

/** Kullanıcının takımına sistem gönderisi ekler (takımı yoksa sessizce çıkar). */
create or replace function public.post_user_activity(
  p_user uuid, p_kind text, p_body text, p_meta jsonb default '{}'
) returns void language plpgsql security definer set search_path = public as $$
declare v_team uuid;
begin
  select team_id into v_team from public.team_members where user_id = p_user limit 1;
  if v_team is null then return; end if;
  -- Aynı kaynak daha önce paylaşıldıysa tekrar etme
  if p_meta ? 'src' and exists (
    select 1 from public.team_posts
     where team_id = v_team and kind = p_kind and meta->>'src' = p_meta->>'src'
  ) then
    return;
  end if;
  insert into public.team_posts (team_id, user_id, kind, body, meta, is_system)
  values (v_team, p_user, p_kind, p_body, coalesce(p_meta, '{}'), true);
end $$;

-- 4a) Antrenman tamamlandığında
--     Not: SQL'de OR kısa devre yapmaz ve INSERT'te OLD atanmamıştır; bu yüzden
--     tg_op kontrolü ayrı bir plpgsql dalında yapılır.
create or replace function public.tg_activity_workout() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text; v_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_changed := true;
  else
    v_changed := old.status is distinct from new.status;
  end if;

  if new.status = 'completed' and v_changed then
    select coalesce(full_name, 'Sporcu') into v_name from public.profiles where id = new.user_id;
    perform public.post_user_activity(
      new.user_id, 'workout',
      v_name
        || case when new.workout_date = current_date then ' bugün ' else ' ' end
        || coalesce(nullif(new.title, ''), 'planladığı') || ' antrenmanını tamamladı.',
      jsonb_build_object('src', new.id::text, 'title', new.title, 'minutes', new.duration_min)
    );
  end if;
  return new;
end $$;
drop trigger if exists trg_activity_workout on public.workouts;
create trigger trg_activity_workout after insert or update of status on public.workouts
  for each row execute function public.tg_activity_workout();

-- 4b) Başarım tamamlandığında
create or replace function public.tg_activity_achievement() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text; v_ach text; v_icon text; v_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_changed := true;
  else
    v_changed := not coalesce(old.completed, false);
  end if;

  if new.completed and v_changed then
    select coalesce(full_name, 'Sporcu') into v_name from public.profiles where id = new.user_id;
    select a.name, a.icon into v_ach, v_icon from public.achievements a where a.id = new.achievement_id;
    perform public.post_user_activity(
      new.user_id, 'badge',
      v_name || ' yeni rozet kazandı: ' || coalesce(v_ach, 'Başarım'),
      jsonb_build_object('src', new.id::text, 'badge', v_ach, 'icon', v_icon)
    );
  end if;
  return new;
end $$;
drop trigger if exists trg_activity_achievement on public.achievement_progress;
create trigger trg_activity_achievement after insert or update of completed on public.achievement_progress
  for each row execute function public.tg_activity_achievement();

-- 4c) Seri kilometre taşları (7'nin katları) + seviye atlama
create or replace function public.tg_activity_gamification() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select coalesce(full_name, 'Sporcu') into v_name from public.profiles where id = new.user_id;

  if new.current_streak > coalesce(old.current_streak, 0)
     and new.current_streak > 0 and new.current_streak % 7 = 0 then
    perform public.post_user_activity(
      new.user_id, 'streak',
      v_name || ' ' || new.current_streak || ' günlük seriye ulaştı!',
      jsonb_build_object('src', new.user_id::text || ':streak:' || new.current_streak, 'streak', new.current_streak)
    );
  end if;

  if new.level > coalesce(old.level, 1) then
    perform public.post_user_activity(
      new.user_id, 'level_up',
      v_name || ' ' || new.level || '. seviyeye yükseldi!',
      jsonb_build_object('src', new.user_id::text || ':level:' || new.level, 'level', new.level)
    );
  end if;

  return new;
end $$;
drop trigger if exists trg_activity_gamification on public.user_gamification;
create trigger trg_activity_gamification after update on public.user_gamification
  for each row execute function public.tg_activity_gamification();

-- ---------------------------------------------------------------------------
-- 5) İstatistik serisi — son N gün (grafikler için)
--    XP, leaderboard_scores ile aynı katsayılardan günlük olarak hesaplanır.
-- ---------------------------------------------------------------------------
create or replace function public.team_stats_series(p_team uuid, p_days int default 30)
returns table (
  d date, xp bigint, workouts bigint, minutes bigint,
  calories bigint, volume_kg bigint, active_users int
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_ids uuid[];
  v_from date := current_date - (greatest(1, coalesce(p_days, 30)) - 1);
  r_workout int; r_volume int; r_water int; r_protein int; r_pr int;
begin
  select array_agg(user_id) into v_ids from public.team_members where team_id = p_team;
  if v_ids is null then return; end if;

  -- Not: OUT parametresi `xp` ile çakışmaması için xp_rules takma adla nitelenir.
  select coalesce((select xr.xp from public.xp_rules xr where xr.event_key='workout_completed' and xr.enabled), 20) into r_workout;
  select coalesce((select xr.xp from public.xp_rules xr where xr.event_key='volume_1000kg'     and xr.enabled),  5) into r_volume;
  select coalesce((select xr.xp from public.xp_rules xr where xr.event_key='water_goal'        and xr.enabled), 10) into r_water;
  select coalesce((select xr.xp from public.xp_rules xr where xr.event_key='protein_goal'      and xr.enabled), 10) into r_protein;
  select coalesce((select xr.xp from public.xp_rules xr where xr.event_key='new_pr'            and xr.enabled), 25) into r_pr;

  return query
  with days as (
    select generate_series(v_from, current_date, interval '1 day')::date as d
  ),
  w as (
    select o.workout_date as d,
           count(*)::bigint n,
           coalesce(sum(o.duration_min), 0)::bigint mins,
           count(distinct o.user_id)::int users
      from public.workouts o
     where o.user_id = any(v_ids) and o.status = 'completed' and o.workout_date >= v_from
     group by o.workout_date
  ),
  vol as (
    select o.workout_date as d,
           coalesce(sum(coalesce(s.reps,0) * coalesce(s.weight_kg,0)), 0)::bigint kg
      from public.workout_sets s
      join public.workouts o on o.id = s.workout_id
     where o.user_id = any(v_ids) and s.completed and o.workout_date >= v_from
     group by o.workout_date
  ),
  cal as (
    select l.log_date as d, coalesce(sum(l.calories), 0)::bigint c
      from public.nutrition_logs l
     where l.user_id = any(v_ids) and l.log_date >= v_from
     group by l.log_date
  ),
  wat as (
    select q.log_date as d, count(*)::bigint n from (
      select l.user_id, l.log_date, sum(l.amount_ml) ml
        from public.water_logs l
       where l.user_id = any(v_ids) and l.log_date >= v_from
       group by l.user_id, l.log_date
    ) q join public.profiles p on p.id = q.user_id
     where q.ml >= coalesce(p.daily_water_goal_ml, 2500)
     group by q.log_date
  ),
  pro as (
    select q.log_date as d, count(*)::bigint n from (
      select l.user_id, l.log_date, sum(l.protein_g) pg
        from public.nutrition_logs l
       where l.user_id = any(v_ids) and l.log_date >= v_from
       group by l.user_id, l.log_date
    ) q join public.profiles p on p.id = q.user_id
     where q.pg >= coalesce(p.daily_protein_goal, 120)
     group by q.log_date
  ),
  prs as (
    select r.achieved_on as d, count(*)::bigint n
      from public.personal_records r
     where r.user_id = any(v_ids) and r.achieved_on >= v_from
     group by r.achieved_on
  )
  select
    days.d,
    (coalesce(w.n,0) * r_workout
     + floor(coalesce(vol.kg,0) / 1000.0)::bigint * r_volume
     + coalesce(wat.n,0) * r_water
     + coalesce(pro.n,0) * r_protein
     + coalesce(prs.n,0) * r_pr)::bigint,
    coalesce(w.n, 0),
    coalesce(w.mins, 0),
    coalesce(cal.c, 0),
    coalesce(vol.kg, 0),
    coalesce(w.users, 0)
  from days
  left join w   on w.d   = days.d
  left join vol on vol.d = days.d
  left join cal on cal.d = days.d
  left join wat on wat.d = days.d
  left join pro on pro.d = days.d
  left join prs on prs.d = days.d
  order by days.d;
end $$;

-- ---------------------------------------------------------------------------
-- 6) Takım nabzı — anlık aktiflik göstergeleri
-- ---------------------------------------------------------------------------
create or replace function public.team_pulse(p_team uuid)
returns table (
  online_now int, active_today int, active_week int,
  participation_pct numeric, live_session uuid
)
language plpgsql stable security definer set search_path = public as $$
declare v_ids uuid[]; v_n int;
begin
  select array_agg(user_id) into v_ids from public.team_members where team_id = p_team;
  if v_ids is null then
    return query select 0, 0, 0, 0::numeric, null::uuid;
    return;
  end if;
  v_n := array_length(v_ids, 1);

  return query
  select
    (select count(*)::int from public.user_presence up
      where up.user_id = any(v_ids) and up.last_seen_at > now() - interval '2 minutes'),
    (select count(distinct o.user_id)::int from public.workouts o
      where o.user_id = any(v_ids) and o.status='completed' and o.workout_date = current_date),
    (select count(distinct o.user_id)::int from public.workouts o
      where o.user_id = any(v_ids) and o.status='completed' and o.workout_date >= current_date - 6),
    round(
      (select count(distinct o.user_id)::numeric from public.workouts o
        where o.user_id = any(v_ids) and o.status='completed' and o.workout_date >= current_date - 6)
      * 100.0 / greatest(v_n, 1), 0),
    (select ls.id from public.team_live_sessions ls
      where ls.team_id = p_team and ls.status = 'live'
      order by ls.started_at desc limit 1);
end $$;

-- ---------------------------------------------------------------------------
-- 7) Sohbet medyası — storage bucket
--    Yol şeması: team-media/<team_id>/<user_id>/<uuid>.<ext>
--    Dosya adları tahmin edilemez; okuma takım üyeleriyle sınırlıdır.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('team-media', 'team-media', false) on conflict (id) do nothing;

/**
 * Yol içindeki ilk klasörü takım kimliği olarak yorumlar.
 * Geçersiz uuid'de hata fırlatmak yerine false döner — böylece bu politika
 * diğer bucket'lardaki nesneleri asla bozmaz (AND kısa devresine güvenilmez).
 */
create or replace function public.is_team_media_member(p_path text, p_user uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_team uuid;
begin
  begin
    v_team := ((storage.foldername(p_path))[1])::uuid;
  exception when others then
    return false;
  end;
  if v_team is null then return false; end if;
  return public.is_team_member(v_team, p_user);
end $$;

drop policy if exists "team_media_read" on storage.objects;
create policy "team_media_read" on storage.objects for select
  using (
    bucket_id = 'team-media'
    and public.is_team_media_member(name, auth.uid())
  );

drop policy if exists "team_media_insert" on storage.objects;
create policy "team_media_insert" on storage.objects for insert
  with check (
    bucket_id = 'team-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_team_media_member(name, auth.uid())
  );

drop policy if exists "team_media_delete" on storage.objects;
create policy "team_media_delete" on storage.objects for delete
  using (
    bucket_id = 'team-media'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 8) Realtime yayını genişletme
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'team_post_reactions','team_post_comments','notifications',
    'team_live_sessions','team_live_participants','user_presence',
    'friendships','team_quests','team_events'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 9) RLS
-- ---------------------------------------------------------------------------
alter table public.friendships             enable row level security;
alter table public.follows                 enable row level security;
alter table public.user_presence           enable row level security;
alter table public.team_live_sessions      enable row level security;
alter table public.team_live_participants  enable row level security;

-- Arkadaşlık: taraflar görür ve yönetir
drop policy if exists friendships_rw on public.friendships;
create policy friendships_rw on public.friendships for all
  using (requester_id = auth.uid() or addressee_id = auth.uid() or public.has_admin_access(auth.uid()))
  with check (requester_id = auth.uid() or addressee_id = auth.uid());

-- Takip: herkes okur, kişi kendi takibini yönetir
drop policy if exists follows_select on public.follows;
create policy follows_select on public.follows for select using (true);
drop policy if exists follows_write on public.follows;
create policy follows_write on public.follows for insert with check (follower_id = auth.uid());
drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows for delete using (follower_id = auth.uid());

-- Presence: giriş yapmış herkes okur (online rozetleri için), kişi kendi satırını yazar
drop policy if exists presence_select on public.user_presence;
create policy presence_select on public.user_presence for select using (auth.uid() is not null);
drop policy if exists presence_write on public.user_presence;
create policy presence_write on public.user_presence for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Canlı oturumlar: takım üyeleri
drop policy if exists live_sessions_select on public.team_live_sessions;
create policy live_sessions_select on public.team_live_sessions for select
  using (public.is_team_member(team_id, auth.uid()) or public.has_admin_access(auth.uid()));
drop policy if exists live_sessions_write on public.team_live_sessions;
create policy live_sessions_write on public.team_live_sessions for insert
  with check (public.is_team_member(team_id, auth.uid()));
drop policy if exists live_sessions_update on public.team_live_sessions;
create policy live_sessions_update on public.team_live_sessions for update
  using (host_id = auth.uid() or public.team_can(team_id, auth.uid(), 'moderator'));

drop policy if exists live_parts_select on public.team_live_participants;
create policy live_parts_select on public.team_live_participants for select
  using (exists (select 1 from public.team_live_sessions s
                  where s.id = session_id and public.is_team_member(s.team_id, auth.uid())));
drop policy if exists live_parts_write on public.team_live_participants;
create policy live_parts_write on public.team_live_participants for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and exists (select 1 from public.team_live_sessions s
                 where s.id = session_id and public.is_team_member(s.team_id, auth.uid())));

-- ---------------------------------------------------------------------------
-- 10) Yetkiler
-- ---------------------------------------------------------------------------
grant execute on function public.are_friends(uuid, uuid)            to authenticated, service_role;
grant execute on function public.friend_ids(uuid)                   to authenticated, service_role;
grant execute on function public.touch_presence(text, text, uuid)   to authenticated, service_role;
grant execute on function public.end_live_session(uuid)             to authenticated, service_role;
grant execute on function public.post_user_activity(uuid, text, text, jsonb) to service_role;
grant execute on function public.team_stats_series(uuid, int)       to authenticated, service_role;
grant execute on function public.team_pulse(uuid)                   to authenticated, service_role;
grant execute on function public.is_team_media_member(text, uuid)   to authenticated, service_role;
