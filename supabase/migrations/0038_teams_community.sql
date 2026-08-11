-- ============================================================================
-- Migration 0038 — Takımlar: Topluluk Sürümü
--
-- Mevcut teams / team_members / team_scores KORUNUR; üzerine topluluk katmanı
-- eklenir: akış (feed), gerçek zamanlı sohbet, görevler, seviye, rozetler,
-- etkinlikler, davetler, katılım istekleri ve roller.
--
-- Additive + idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) teams — topluluk alanları
-- ---------------------------------------------------------------------------
alter table public.teams
  add column if not exists logo_url      text,
  add column if not exists cover_url     text,
  add column if not exists city          text,
  add column if not exists country       text,
  add column if not exists visibility    text not null default 'public',   -- public | private
  add column if not exists join_policy   text not null default 'open',     -- open | request | invite
  add column if not exists invite_code   text,
  add column if not exists member_limit  int  not null default 100,
  add column if not exists level         int  not null default 1,
  add column if not exists rules         text,
  add column if not exists updated_at    timestamptz not null default now();

-- Benzersiz davet kodu (6 karakter, karışabilecek harfler hariç)
create or replace function public.gen_team_code() returns text
language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.teams t where t.invite_code = code);
  end loop;
  return code;
end $$;

update public.teams set invite_code = public.gen_team_code() where invite_code is null;
create unique index if not exists uq_teams_invite_code on public.teams (invite_code);

-- ---------------------------------------------------------------------------
-- 2) team_posts — sosyal akış
--    kind: post | workout | badge | streak | level_up | member_joined | quest
-- ---------------------------------------------------------------------------
create table if not exists public.team_posts (
  id         uuid primary key default uuid_generate_v4(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  kind       text not null default 'post',
  body       text,
  meta       jsonb not null default '{}',      -- {xp, badge, streak, workout_title, ...}
  is_system  boolean not null default false,
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_team_posts_team on public.team_posts (team_id, created_at desc);

-- Tepkiler: like | fire | clap  (kullanıcı başına tepki türü tekil)
create table if not exists public.team_post_reactions (
  id         uuid primary key default uuid_generate_v4(),
  post_id    uuid not null references public.team_posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null default 'like',
  created_at timestamptz not null default now(),
  unique (post_id, user_id, kind)
);
create index if not exists idx_post_reactions_post on public.team_post_reactions (post_id);

create table if not exists public.team_post_comments (
  id         uuid primary key default uuid_generate_v4(),
  post_id    uuid not null references public.team_posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_post_comments_post on public.team_post_comments (post_id, created_at);

-- ---------------------------------------------------------------------------
-- 3) team_messages — gerçek zamanlı sohbet
--    kind: text | image | gif | file | workout | meal
-- ---------------------------------------------------------------------------
create table if not exists public.team_messages (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  body        text,
  kind        text not null default 'text',
  attachment  jsonb not null default '{}',    -- {url, name, size, mime, preview}
  reply_to    uuid references public.team_messages(id) on delete set null,
  pinned      boolean not null default false,
  edited_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_team_messages_team on public.team_messages (team_id, created_at desc);
create index if not exists idx_team_messages_pinned on public.team_messages (team_id) where pinned;

-- ---------------------------------------------------------------------------
-- 4) team_quests — takım görevleri
--    metric: workouts | steps | xp | minutes | volume_kg | water_ml | active_days
-- ---------------------------------------------------------------------------
create table if not exists public.team_quests (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  title       text not null,
  description text,
  metric      text not null default 'workouts',
  target      numeric(14,2) not null default 100,
  reward_xp   int not null default 100,
  reward_badge text,
  starts_on   date not null default current_date,
  ends_on     date,
  status      text not null default 'active',   -- active | completed | archived
  completed_at timestamptz,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_team_quests_team on public.team_quests (team_id, status);

-- ---------------------------------------------------------------------------
-- 5) team_badges — rozet kataloğu + kazanımlar
-- ---------------------------------------------------------------------------
create table if not exists public.team_badges (
  id          uuid primary key default uuid_generate_v4(),
  slug        text unique not null,
  name        text not null,
  description text,
  icon        text,
  tier        text not null default 'bronze',   -- bronze | silver | gold | platinum | diamond
  rule_metric text,                              -- total_xp | members | streak_days | weekly_rank
  rule_value  numeric(14,2),
  sort_order  int not null default 0
);

create table if not exists public.team_badge_awards (
  id         uuid primary key default uuid_generate_v4(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  badge_id   uuid not null references public.team_badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  unique (team_id, badge_id)
);
create index if not exists idx_team_badge_awards_team on public.team_badge_awards (team_id);

insert into public.team_badges (slug, name, description, icon, tier, rule_metric, rule_value, sort_order) values
  ('xp_10k',     '10.000 XP',        'Takım toplam 10.000 XP topladı.',       '⚡', 'bronze',   'total_xp', 10000,   1),
  ('xp_100k',    '100.000 XP',       'Takım toplam 100.000 XP topladı.',      '🔥', 'silver',   'total_xp', 100000,  2),
  ('xp_1m',      '1.000.000 XP',     'Efsanevi: 1 milyon XP.',                '👑', 'diamond',  'total_xp', 1000000, 3),
  ('members_10', '10 Üye',           'Takım 10 üyeye ulaştı.',                '🤝', 'bronze',   'members',  10,      4),
  ('members_50', '50 Üye',           'Takım 50 üyeye ulaştı.',                '🏟️', 'gold',     'members',  50,      5),
  ('members_100','100 Üye',          'Takım 100 üyeye ulaştı.',               '🌆', 'platinum', 'members',  100,     6),
  ('streak_30',  '30 Günlük Seri',   'Takımda 30 gün kesintisiz aktivite.',   '📅', 'gold',     'streak_days', 30,   7),
  ('weekly_top', 'Haftanın Takımı',  'Haftalık sıralamada 1. oldu.',          '🏆', 'gold',     'weekly_rank', 1,    8),
  ('most_active','En Aktif Takım',   'Ortalama günlük aktivitede zirvede.',   '🚀', 'platinum', null,       null,    9)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 6) team_events — etkinlikler
--    kind: challenge | meetup | live | monthly
-- ---------------------------------------------------------------------------
create table if not exists public.team_events (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  title       text not null,
  description text,
  kind        text not null default 'challenge',
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  location    text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_team_events_team on public.team_events (team_id, starts_at desc);

create table if not exists public.team_event_participants (
  id        uuid primary key default uuid_generate_v4(),
  event_id  uuid not null references public.team_events(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  status    text not null default 'going',   -- going | maybe | declined
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 7) Davetler + katılım istekleri
-- ---------------------------------------------------------------------------
create table if not exists public.team_invites (
  id         uuid primary key default uuid_generate_v4(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  token      text unique not null,
  created_by uuid references auth.users(id) on delete set null,
  max_uses   int,
  uses       int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_team_invites_team on public.team_invites (team_id);

create table if not exists public.team_join_requests (
  id         uuid primary key default uuid_generate_v4(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  message    text,
  status     text not null default 'pending',  -- pending | approved | rejected
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);
create index if not exists idx_team_join_req on public.team_join_requests (team_id, status);

-- ---------------------------------------------------------------------------
-- 8) Yetki yardımcıları
-- ---------------------------------------------------------------------------
create or replace function public.team_role(p_team uuid, p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.team_members where team_id = p_team and user_id = p_user;
$$;

create or replace function public.is_team_member(p_team uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where team_id = p_team and user_id = p_user);
$$;

/** owner > admin > moderator > member sıralamasında yetki kontrolü. */
create or replace function public.team_can(p_team uuid, p_user uuid, p_min_role text)
returns boolean language sql stable security definer set search_path = public as $$
  with r as (select public.team_role(p_team, p_user) as role)
  select case (select role from r)
    when 'owner'     then true
    when 'admin'     then p_min_role in ('admin','moderator','member')
    when 'moderator' then p_min_role in ('moderator','member')
    when 'member'    then p_min_role = 'member'
    else false end;
$$;

-- ---------------------------------------------------------------------------
-- 9) Takım istatistikleri (tek sorguda)
--    Dönem XP'si leaderboard_scores() ile hesaplanır (xp_logs boş olabilir).
-- ---------------------------------------------------------------------------
create or replace function public.team_stats(p_team uuid)
returns table (
  member_count int, total_xp bigint, weekly_xp bigint,
  workouts bigint, minutes bigint, calories bigint, steps bigint,
  active_days_avg numeric, level int
)
language plpgsql stable security definer set search_path = public as $$
declare v_ids uuid[]; v_week date := current_date - 6;
begin
  select array_agg(user_id) into v_ids from public.team_members where team_id = p_team;
  if v_ids is null then
    return query select 0, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::numeric, 1;
    return;
  end if;

  return query
  with
  tot as (select coalesce(sum(g.total_xp),0)::bigint x from public.user_gamification g where g.user_id = any(v_ids)),
  wk  as (select coalesce(sum(s.score),0)::bigint x from public.leaderboard_scores(v_week, current_date) s where s.user_id = any(v_ids)),
  w   as (
    select count(*)::bigint n,
           coalesce(sum(o.duration_min),0)::bigint mins
    from public.workouts o where o.user_id = any(v_ids) and o.status='completed'
  ),
  cal as (select coalesce(sum(l.calories),0)::bigint c from public.nutrition_logs l where l.user_id = any(v_ids)),
  stp as (select coalesce(sum(coalesce(p.daily_step_count,0)),0)::bigint s from public.profiles p where p.id = any(v_ids)),
  act as (
    select coalesce(avg(cnt),0)::numeric a from (
      select o.user_id, count(distinct o.workout_date) cnt
      from public.workouts o
      where o.user_id = any(v_ids) and o.status='completed' and o.workout_date >= current_date - 29
      group by o.user_id
    ) q
  )
  select array_length(v_ids,1),
         (select x from tot), (select x from wk),
         (select n from w), (select mins from w),
         (select c from cal), (select s from stp),
         round((select a from act) / 30.0, 2),
         greatest(1, floor(sqrt((select x from tot)::numeric / 500))::int + 1);
end $$;

-- Takım seviyesini kaydeder + seviye atlama olayını akışa düşer.
create or replace function public.sync_team_level(p_team uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_level int; v_prev int;
begin
  select level into v_prev from public.teams where id = p_team;
  select s.level into v_level from public.team_stats(p_team) s;
  if v_level is null then return coalesce(v_prev, 1); end if;
  if v_level <> coalesce(v_prev, 1) then
    update public.teams set level = v_level, updated_at = now() where id = p_team;
    if v_level > coalesce(v_prev, 1) then
      insert into public.team_posts (team_id, kind, body, meta, is_system)
      values (p_team, 'level_up', 'Takım ' || v_level || '. seviyeye ulaştı!', jsonb_build_object('level', v_level), true);
    end if;
  end if;
  return v_level;
end $$;

-- Rozet değerlendirmesi: kurallara uyan rozetleri verir, akışa düşer.
create or replace function public.evaluate_team_badges(p_team uuid)
returns int language plpgsql security definer set search_path = public as $$
declare b record; s record; n int := 0;
begin
  select * into s from public.team_stats(p_team);
  if s is null then return 0; end if;
  for b in select * from public.team_badges where rule_metric is not null loop
    if (b.rule_metric = 'total_xp' and s.total_xp >= b.rule_value)
    or (b.rule_metric = 'members'  and s.member_count >= b.rule_value)
    then
      if not exists (select 1 from public.team_badge_awards a where a.team_id = p_team and a.badge_id = b.id) then
        insert into public.team_badge_awards (team_id, badge_id) values (p_team, b.id);
        insert into public.team_posts (team_id, kind, body, meta, is_system)
        values (p_team, 'badge', 'Takım yeni rozet kazandı: ' || b.name, jsonb_build_object('badge', b.name, 'icon', b.icon, 'tier', b.tier), true);
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
end $$;

-- Görev ilerlemesi (metriğe göre canlı hesap)
create or replace function public.team_quest_progress(p_quest uuid)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare q record; v_ids uuid[]; v numeric := 0;
begin
  select * into q from public.team_quests where id = p_quest;
  if not found then return 0; end if;
  select array_agg(user_id) into v_ids from public.team_members where team_id = q.team_id;
  if v_ids is null then return 0; end if;

  if q.metric = 'workouts' then
    select count(*) into v from public.workouts o
      where o.user_id = any(v_ids) and o.status='completed'
        and o.workout_date >= q.starts_on and (q.ends_on is null or o.workout_date <= q.ends_on);
  elsif q.metric = 'minutes' then
    select coalesce(sum(o.duration_min),0) into v from public.workouts o
      where o.user_id = any(v_ids) and o.status='completed'
        and o.workout_date >= q.starts_on and (q.ends_on is null or o.workout_date <= q.ends_on);
  elsif q.metric = 'volume_kg' then
    select coalesce(sum(coalesce(ws.reps,0)*coalesce(ws.weight_kg,0)),0) into v
      from public.workout_sets ws join public.workouts o on o.id = ws.workout_id
      where o.user_id = any(v_ids) and ws.completed
        and o.workout_date >= q.starts_on and (q.ends_on is null or o.workout_date <= q.ends_on);
  elsif q.metric = 'water_ml' then
    select coalesce(sum(l.amount_ml),0) into v from public.water_logs l
      where l.user_id = any(v_ids) and l.log_date >= q.starts_on and (q.ends_on is null or l.log_date <= q.ends_on);
  elsif q.metric = 'active_days' then
    select count(distinct o.workout_date) into v from public.workouts o
      where o.user_id = any(v_ids) and o.status='completed'
        and o.workout_date >= q.starts_on and (q.ends_on is null or o.workout_date <= q.ends_on);
  elsif q.metric = 'steps' then
    select coalesce(sum(coalesce(p.daily_step_count,0)),0) into v from public.profiles p where p.id = any(v_ids);
  else -- xp
    select coalesce(sum(sc.score),0) into v
      from public.leaderboard_scores(q.starts_on, coalesce(q.ends_on, current_date)) sc
      where sc.user_id = any(v_ids);
  end if;
  return coalesce(v, 0);
end $$;

-- ---------------------------------------------------------------------------
-- 10) Akış tetikleyicisi: yeni üye katıldığında sistem gönderisi
-- ---------------------------------------------------------------------------
create or replace function public.tg_team_member_joined() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select coalesce(full_name, 'Yeni üye') into v_name from public.profiles where id = new.user_id;
  insert into public.team_posts (team_id, user_id, kind, body, meta, is_system)
  values (new.team_id, new.user_id, 'member_joined', v_name || ' takıma katıldı!', '{}', true);
  return new;
end $$;
drop trigger if exists trg_team_member_joined on public.team_members;
create trigger trg_team_member_joined after insert on public.team_members
  for each row execute function public.tg_team_member_joined();

-- ---------------------------------------------------------------------------
-- 11) Realtime: sohbet + akış canlı yayına eklenir
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['team_messages','team_posts'] loop
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
-- 12) RLS
-- ---------------------------------------------------------------------------
alter table public.team_posts             enable row level security;
alter table public.team_post_reactions    enable row level security;
alter table public.team_post_comments     enable row level security;
alter table public.team_messages          enable row level security;
alter table public.team_quests            enable row level security;
alter table public.team_badges            enable row level security;
alter table public.team_badge_awards      enable row level security;
alter table public.team_events            enable row level security;
alter table public.team_event_participants enable row level security;
alter table public.team_invites           enable row level security;
alter table public.team_join_requests     enable row level security;

-- Katalog: herkes okur, admin yazar
drop policy if exists team_badges_select on public.team_badges;
create policy team_badges_select on public.team_badges for select using (true);
drop policy if exists team_badges_admin on public.team_badges;
create policy team_badges_admin on public.team_badges for all
  using (public.has_admin_access(auth.uid())) with check (public.has_admin_access(auth.uid()));

drop policy if exists team_badge_awards_select on public.team_badge_awards;
create policy team_badge_awards_select on public.team_badge_awards for select using (true);

-- Akış / sohbet / görev / etkinlik: yalnızca takım üyeleri (admin hepsini görür)
do $$
declare t text;
begin
  foreach t in array array['team_posts','team_messages','team_quests','team_events'] loop
    execute format('drop policy if exists %I on public.%I', t||'_member_select', t);
    execute format($f$create policy %I on public.%I for select
      using (public.is_team_member(team_id, auth.uid()) or public.has_admin_access(auth.uid()))$f$,
      t||'_member_select', t);
    execute format('drop policy if exists %I on public.%I', t||'_member_insert', t);
    execute format($f$create policy %I on public.%I for insert
      with check (public.is_team_member(team_id, auth.uid()))$f$, t||'_member_insert', t);
  end loop;
end $$;

-- Kendi gönderisini/mesajını silebilir; moderatör+ hepsini yönetebilir
drop policy if exists team_posts_manage on public.team_posts;
create policy team_posts_manage on public.team_posts for update using (
  user_id = auth.uid() or public.team_can(team_id, auth.uid(), 'moderator') or public.has_admin_access(auth.uid())
);
drop policy if exists team_posts_delete on public.team_posts;
create policy team_posts_delete on public.team_posts for delete using (
  user_id = auth.uid() or public.team_can(team_id, auth.uid(), 'moderator') or public.has_admin_access(auth.uid())
);
drop policy if exists team_messages_manage on public.team_messages;
create policy team_messages_manage on public.team_messages for update using (
  user_id = auth.uid() or public.team_can(team_id, auth.uid(), 'moderator') or public.has_admin_access(auth.uid())
);
drop policy if exists team_messages_delete on public.team_messages;
create policy team_messages_delete on public.team_messages for delete using (
  user_id = auth.uid() or public.team_can(team_id, auth.uid(), 'moderator') or public.has_admin_access(auth.uid())
);

-- Tepki/yorum: gönderinin takımının üyesi
drop policy if exists team_post_reactions_all on public.team_post_reactions;
create policy team_post_reactions_all on public.team_post_reactions for all
  using (exists (select 1 from public.team_posts p where p.id = post_id and public.is_team_member(p.team_id, auth.uid())))
  with check (user_id = auth.uid() and exists (select 1 from public.team_posts p where p.id = post_id and public.is_team_member(p.team_id, auth.uid())));

drop policy if exists team_post_comments_select on public.team_post_comments;
create policy team_post_comments_select on public.team_post_comments for select
  using (exists (select 1 from public.team_posts p where p.id = post_id and public.is_team_member(p.team_id, auth.uid())));
drop policy if exists team_post_comments_write on public.team_post_comments;
create policy team_post_comments_write on public.team_post_comments for insert
  with check (user_id = auth.uid() and exists (select 1 from public.team_posts p where p.id = post_id and public.is_team_member(p.team_id, auth.uid())));
drop policy if exists team_post_comments_delete on public.team_post_comments;
create policy team_post_comments_delete on public.team_post_comments for delete
  using (user_id = auth.uid() or exists (select 1 from public.team_posts p where p.id = post_id and public.team_can(p.team_id, auth.uid(), 'moderator')));

-- Etkinlik katılımı: üyeler kendi kaydını yönetir
drop policy if exists team_event_participants_all on public.team_event_participants;
create policy team_event_participants_all on public.team_event_participants for all
  using (exists (select 1 from public.team_events e where e.id = event_id and public.is_team_member(e.team_id, auth.uid())))
  with check (user_id = auth.uid());

-- Davetler: yönetim görür/oluşturur, token ile katılım server action üzerinden
drop policy if exists team_invites_manage on public.team_invites;
create policy team_invites_manage on public.team_invites for all
  using (public.team_can(team_id, auth.uid(), 'admin') or public.has_admin_access(auth.uid()))
  with check (public.team_can(team_id, auth.uid(), 'admin'));

-- Katılım istekleri: kullanıcı kendi isteğini, yönetim takımınkileri görür
drop policy if exists team_join_requests_rw on public.team_join_requests;
create policy team_join_requests_rw on public.team_join_requests for all
  using (user_id = auth.uid() or public.team_can(team_id, auth.uid(), 'admin') or public.has_admin_access(auth.uid()))
  with check (user_id = auth.uid() or public.team_can(team_id, auth.uid(), 'admin'));

grant execute on function public.team_stats(uuid)            to authenticated, service_role;
grant execute on function public.sync_team_level(uuid)        to authenticated, service_role;
grant execute on function public.evaluate_team_badges(uuid)   to authenticated, service_role;
grant execute on function public.team_quest_progress(uuid)    to authenticated, service_role;
grant execute on function public.team_role(uuid, uuid)        to authenticated, service_role;
grant execute on function public.is_team_member(uuid, uuid)   to authenticated, service_role;
grant execute on function public.team_can(uuid, uuid, text)   to authenticated, service_role;
grant execute on function public.gen_team_code()              to authenticated, service_role;
