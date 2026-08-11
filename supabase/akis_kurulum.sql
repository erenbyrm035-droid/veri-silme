-- ============================================================================
-- 0044 — Kişisel akış, keşif ve arkadaş bazlı Workout Party
--
-- Tasarım kararı: YENİ akış tablosu kurulmaz. `team_posts` zaten tepki, yorum,
-- sistem aktivitesi, sabitleme ve realtime altyapısına sahip. Bu migration onu
-- "takıma ait gönderi" olmaktan çıkarıp genel bir gönderi tablosuna çevirir:
--   team_id  null  → takıma ait değil (kişisel akış gönderisi)
--   visibility     → team | friends | public
-- Mevcut satırların hepsi team_id dolu + visibility 'team' olduğu için takım
-- akışı davranışı BİREBİR korunur.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) team_posts — kişisel/arkadaş/herkese açık gönderiler
-- ---------------------------------------------------------------------------
alter table public.team_posts alter column team_id drop not null;
alter table public.team_posts add column if not exists visibility text not null default 'team';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_posts_visibility_chk'
  ) then
    alter table public.team_posts
      add constraint team_posts_visibility_chk
      check (visibility in ('team', 'friends', 'public'));
  end if;
end $$;

-- Takımı olmayan gönderi mutlaka bir yazara sahip olmalı; aksi halde kimseye
-- ait olmayan, hiçbir kapsamdan görünmeyen "yetim" satır oluşurdu.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_posts_owner_chk'
  ) then
    alter table public.team_posts
      add constraint team_posts_owner_chk
      check (team_id is not null or user_id is not null);
  end if;
end $$;

create index if not exists idx_team_posts_author  on public.team_posts (user_id, created_at desc);
create index if not exists idx_team_posts_global  on public.team_posts (visibility, created_at desc)
  where team_id is null;

-- ---------------------------------------------------------------------------
-- 2) Sosyal görünürlük yardımcıları
-- ---------------------------------------------------------------------------

/** İki kullanıcı kabul edilmiş arkadaş mı? (yön bağımsız) */
create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_a is not null and p_b is not null and exists (
    select 1 from public.friendships f
     where f.status = 'accepted'
       and ((f.requester_id = p_a and f.addressee_id = p_b)
         or (f.requester_id = p_b and f.addressee_id = p_a))
  );
$$;

/**
 * Bir gönderi verilen kullanıcıya görünür mü?
 *
 * Not: Parametreler (p_team, p_author, p_visibility) satırdan geçilir; fonksiyon
 * team_posts'a geri sorgu atmaz. Böylece RLS politikası içinde kullanıldığında
 * özyinelemeli politika değerlendirmesi oluşmaz.
 */
create or replace function public.can_see_post(
  p_team uuid, p_author uuid, p_visibility text, p_viewer uuid
) returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_viewer is null then false
    when p_author = p_viewer then true
    when p_team is not null then public.is_team_member(p_team, p_viewer)
    when p_visibility = 'public' then true
    when p_visibility = 'friends' then public.are_friends(p_author, p_viewer)
    else false
  end or public.has_admin_access(p_viewer);
$$;

-- ---------------------------------------------------------------------------
-- 3) team_posts + tepki/yorum RLS'i genel görünürlüğe göre yeniden yazılır
--    (0038'deki takım-yalnız politikalar bu satırlarda okumaya izin vermezdi)
-- ---------------------------------------------------------------------------
drop policy if exists team_posts_member_select on public.team_posts;
create policy team_posts_member_select on public.team_posts for select
  using (public.can_see_post(team_id, user_id, visibility, auth.uid()));

drop policy if exists team_posts_member_insert on public.team_posts;
create policy team_posts_member_insert on public.team_posts for insert
  with check (
    case
      when team_id is not null then public.is_team_member(team_id, auth.uid())
      else user_id = auth.uid()
    end
  );

drop policy if exists team_post_reactions_all on public.team_post_reactions;
create policy team_post_reactions_all on public.team_post_reactions for all
  using (exists (
    select 1 from public.team_posts p
     where p.id = post_id and public.can_see_post(p.team_id, p.user_id, p.visibility, auth.uid())))
  with check (user_id = auth.uid() and exists (
    select 1 from public.team_posts p
     where p.id = post_id and public.can_see_post(p.team_id, p.user_id, p.visibility, auth.uid())));

drop policy if exists team_post_comments_select on public.team_post_comments;
create policy team_post_comments_select on public.team_post_comments for select
  using (exists (
    select 1 from public.team_posts p
     where p.id = post_id and public.can_see_post(p.team_id, p.user_id, p.visibility, auth.uid())));

drop policy if exists team_post_comments_write on public.team_post_comments;
create policy team_post_comments_write on public.team_post_comments for insert
  with check (user_id = auth.uid() and exists (
    select 1 from public.team_posts p
     where p.id = post_id and public.can_see_post(p.team_id, p.user_id, p.visibility, auth.uid())));

drop policy if exists team_post_comments_delete on public.team_post_comments;
create policy team_post_comments_delete on public.team_post_comments for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from public.team_posts p
                where p.id = post_id and p.user_id = auth.uid())
    or exists (select 1 from public.team_posts p
                where p.id = post_id and p.team_id is not null
                  and public.team_can(p.team_id, auth.uid(), 'moderator'))
  );

-- ---------------------------------------------------------------------------
-- 4) feed_post_ids — kapsam bazlı akış sayfalama
--    Zenginleştirme (profil/tepki/yorum) uygulama katmanında yapılır; burada
--    yalnızca hangi gönderilerin görüneceği ve sırası belirlenir.
--    p_scope: friends | mine | team | public
-- ---------------------------------------------------------------------------
create or replace function public.feed_post_ids(
  p_user uuid,
  p_scope text default 'friends',
  p_limit int default 30,
  p_offset int default 0
) returns table (post_id uuid, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  with my_teams as (
    select tm.team_id from public.team_members tm where tm.user_id = p_user
  ),
  my_friends as (
    select case when f.requester_id = p_user then f.addressee_id else f.requester_id end as uid
      from public.friendships f
     where f.status = 'accepted'
       and (f.requester_id = p_user or f.addressee_id = p_user)
  )
  select p.id, p.created_at
    from public.team_posts p
   where case p_scope
     when 'mine' then p.user_id = p_user
     when 'team' then p.team_id in (select team_id from my_teams)
     when 'public' then
       (p.team_id is null and p.visibility = 'public')
       or p.team_id in (select team_id from my_teams)
       or (p.team_id is null and p.visibility = 'friends'
           and (p.user_id = p_user or p.user_id in (select uid from my_friends)))
     -- 'friends' (varsayılan): arkadaşlarım + kendi gönderilerim + takımlarım
     else
       p.user_id = p_user
       or p.team_id in (select team_id from my_teams)
       or (p.team_id is null and p.user_id in (select uid from my_friends)
           and p.visibility in ('friends', 'public'))
   end
   order by p.created_at desc
   limit greatest(1, least(coalesce(p_limit, 30), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

-- ---------------------------------------------------------------------------
-- 5) Keşif RPC'leri
-- ---------------------------------------------------------------------------

/** Son p_days günde en çok çalışılan egzersizler. */
create or replace function public.trending_exercises(p_days int default 14, p_limit int default 12)
returns table (
  exercise_id uuid, name text, slug text, category text, image_url text,
  sessions int, athletes int, total_volume numeric
) language sql stable security definer set search_path = public as $$
  select e.id, e.name, e.slug, e.category, e.image_url,
         count(distinct w.id)::int,
         count(distinct w.user_id)::int,
         coalesce(sum(coalesce(s.weight_kg, 0) * coalesce(s.reps, 0)), 0)::numeric
    from public.workout_sets s
    join public.workouts w on w.id = s.workout_id
    join public.exercises e on e.id = s.exercise_id
   where w.status = 'completed'
     and w.workout_date >= current_date - greatest(1, coalesce(p_days, 14))
   group by e.id, e.name, e.slug, e.category, e.image_url
   order by count(distinct w.user_id) desc, count(distinct w.id) desc
   limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

/**
 * Öne çıkan sporcular: dönem XP'si + takipçi sayısı.
 * Kendini ve zaten arkadaş olduklarını dışarıda bırakır — keşif sekmesinin
 * amacı yeni kişi bulmak.
 */
create or replace function public.popular_users(p_user uuid, p_limit int default 12)
returns table (
  user_id uuid, name text, avatar_url text, level int, total_xp int,
  streak int, followers int, is_following boolean
) language sql stable security definer set search_path = public as $$
  select g.user_id,
         coalesce(pr.full_name, 'Viva Sporcusu'),
         pr.avatar_url,
         coalesce(g.level, 1),
         coalesce(g.total_xp, 0),
         coalesce(g.current_streak, 0),
         coalesce(fc.n, 0)::int,
         exists (select 1 from public.follows f
                  where f.follower_id = p_user and f.following_id = g.user_id)
    from public.user_gamification g
    join public.profiles pr on pr.id = g.user_id
    left join lateral (
      select count(*) as n from public.follows f where f.following_id = g.user_id
    ) fc on true
   where g.user_id <> p_user
     and not public.are_friends(g.user_id, p_user)
   order by coalesce(g.total_xp, 0) desc, coalesce(fc.n, 0) desc
   limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

-- ---------------------------------------------------------------------------
-- 6) Workout Party v2 — arkadaş bazlı oturumlar
-- ---------------------------------------------------------------------------
alter table public.team_live_sessions alter column team_id drop not null;
alter table public.team_live_sessions add column if not exists visibility text not null default 'team';
alter table public.team_live_sessions add column if not exists activity   text not null default 'strength';
-- MET (Metabolic Equivalent of Task) — kalori tahmininin katsayısı.
-- Oturum başlarken seçilen aktiviteye göre yazılır, bitişte kullanılır.
alter table public.team_live_sessions add column if not exists met numeric(4,2) not null default 5.0;

alter table public.team_live_participants add column if not exists calories int not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'live_sessions_visibility_chk') then
    alter table public.team_live_sessions
      add constraint live_sessions_visibility_chk check (visibility in ('team', 'friends'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'live_sessions_owner_chk') then
    alter table public.team_live_sessions
      add constraint live_sessions_owner_chk check (team_id is not null or host_id is not null);
  end if;
end $$;

create index if not exists idx_live_sessions_host on public.team_live_sessions (host_id, status, started_at desc);

/** Arkadaş partisine davetler — kabul edilince katılımcıya dönüşür. */
create table if not exists public.live_session_invites (
  id         uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.team_live_sessions(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (session_id, user_id)
);
create index if not exists idx_live_invites_user on public.live_session_invites (user_id, created_at desc);

/** Bir canlı oturum verilen kullanıcıya görünür mü? */
create or replace function public.can_see_live_session(p_session uuid, p_viewer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_live_sessions s
     where s.id = p_session
       and (
         s.host_id = p_viewer
         or (s.team_id is not null and public.is_team_member(s.team_id, p_viewer))
         or exists (select 1 from public.live_session_invites i
                     where i.session_id = s.id and i.user_id = p_viewer)
         or exists (select 1 from public.team_live_participants lp
                     where lp.session_id = s.id and lp.user_id = p_viewer)
         or (s.team_id is null and s.visibility = 'friends'
             and public.are_friends(s.host_id, p_viewer))
       )
  );
$$;

alter table public.live_session_invites enable row level security;

drop policy if exists live_invites_select on public.live_session_invites;
create policy live_invites_select on public.live_session_invites for select
  using (user_id = auth.uid() or invited_by = auth.uid() or public.has_admin_access(auth.uid()));

drop policy if exists live_invites_write on public.live_session_invites;
create policy live_invites_write on public.live_session_invites for insert
  with check (invited_by = auth.uid());

drop policy if exists live_invites_delete on public.live_session_invites;
create policy live_invites_delete on public.live_session_invites for delete
  using (user_id = auth.uid() or invited_by = auth.uid());

-- 0039'daki politikalar team_id'yi zorunlu varsayıyordu; arkadaş oturumları
-- (team_id null) için yeniden yazılır.
drop policy if exists live_sessions_select on public.team_live_sessions;
create policy live_sessions_select on public.team_live_sessions for select
  using (public.can_see_live_session(id, auth.uid()) or public.has_admin_access(auth.uid()));

drop policy if exists live_sessions_write on public.team_live_sessions;
create policy live_sessions_write on public.team_live_sessions for insert
  with check (
    host_id = auth.uid()
    and (team_id is null or public.is_team_member(team_id, auth.uid()))
  );

drop policy if exists live_sessions_update on public.team_live_sessions;
create policy live_sessions_update on public.team_live_sessions for update
  using (
    host_id = auth.uid()
    or (team_id is not null and public.team_can(team_id, auth.uid(), 'moderator'))
    or public.has_admin_access(auth.uid())
  );

drop policy if exists live_parts_select on public.team_live_participants;
create policy live_parts_select on public.team_live_participants for select
  using (public.can_see_live_session(session_id, auth.uid()) or public.has_admin_access(auth.uid()));

drop policy if exists live_parts_write on public.team_live_participants;
create policy live_parts_write on public.team_live_participants for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_see_live_session(session_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- 7) end_live_session v2 — kalori tahmini + takımsız oturum desteği
--    Kalori = MET × 3.5 × kg / 200 × dakika  (ACSM standardı)
-- ---------------------------------------------------------------------------
create or replace function public.end_live_session(p_session uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  s record; v_count int; v_bonus int; v_total int := 0; v_names text; v_minutes int;
begin
  select * into s from public.team_live_sessions where id = p_session;
  if not found or s.status = 'ended' then return 0; end if;

  update public.team_live_participants p
     set left_at = coalesce(p.left_at, now()),
         duration_sec = greatest(0, extract(epoch from (coalesce(p.left_at, now()) - p.joined_at))::int)
   where p.session_id = p_session;

  select count(*) into v_count from public.team_live_participants where session_id = p_session;
  -- Birlikte antrenman bonusu: katılımcı başına 25 XP + her ek kişi için 3 XP
  v_bonus := greatest(0, 25 + (v_count - 1) * 3);

  -- Kalori: katılımcının kendi kilosuyla, oturumun MET'i üzerinden.
  -- Kilo bilinmiyorsa 70 kg varsayılır (Türkiye ortalamasına yakın makul taban).
  update public.team_live_participants lp
     set xp_earned = v_bonus,
         calories = greatest(0, round(
           coalesce(s.met, 5.0) * 3.5 * coalesce(pr.weight_kg, 70) / 200.0
           * (lp.duration_sec / 60.0)
         ))::int
    from public.profiles pr
   where lp.session_id = p_session and pr.id = lp.user_id;

  -- Profili olmayan katılımcı kalırsa XP'si yine de yazılsın
  update public.team_live_participants
     set xp_earned = v_bonus
   where session_id = p_session and xp_earned = 0;

  v_total := v_bonus * coalesce(v_count, 0);
  v_minutes := greatest(1, extract(epoch from (now() - s.started_at))::int / 60);

  update public.team_live_sessions
     set status = 'ended', ended_at = now(), total_xp = v_total
   where id = p_session;

  select string_agg(coalesce(pr.full_name, 'Sporcu'), ', ')
    into v_names
    from public.team_live_participants lp
    join public.profiles pr on pr.id = lp.user_id
   where lp.session_id = p_session;

  -- Akışa düşür: takım oturumu takım akışına, arkadaş partisi kişisel akışa.
  insert into public.team_posts (team_id, user_id, kind, body, meta, is_system, visibility)
  values (
    s.team_id, s.host_id, 'live_workout',
    coalesce(v_names, 'Takım') || ' birlikte antrenmanı tamamladı!',
    jsonb_build_object(
      'participants', v_count, 'bonus_xp', v_bonus, 'total_xp', v_total,
      'minutes', v_minutes,
      'calories', coalesce((select sum(calories) from public.team_live_participants
                             where session_id = p_session), 0)
    ),
    true,
    case when s.team_id is null then 'friends' else 'team' end
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
-- 8) Realtime + yetkiler
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['live_session_invites'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
    execute format('alter table public.%I replica identity full', t);
  end loop;
exception when undefined_object then
  -- supabase_realtime yayını yoksa (yerel replika) sessizce geç
  null;
end $$;

grant execute on function public.are_friends(uuid, uuid)                     to authenticated, service_role;
grant execute on function public.can_see_post(uuid, uuid, text, uuid)        to authenticated, service_role;
grant execute on function public.can_see_live_session(uuid, uuid)            to authenticated, service_role;
grant execute on function public.feed_post_ids(uuid, text, int, int)         to authenticated, service_role;
grant execute on function public.trending_exercises(int, int)                to authenticated, service_role;
grant execute on function public.popular_users(uuid, int)                    to authenticated, service_role;
