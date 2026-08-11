-- ============================================================================
-- Takımlar modülü — KURULUM DOĞRULAMA
--
-- Bu betik hiçbir şey değiştirmez; yalnızca okur ve rapor üretir.
-- Supabase → SQL Editor'e yapıştırıp çalıştır, çıkan tabloyu bana gönder.
-- "durum" sütununda tek bir ✗ bile olmamalı.
-- ============================================================================

with beklenen_tablolar(ad) as (
  values
    ('team_posts'), ('team_post_reactions'), ('team_post_comments'),
    ('team_messages'), ('team_quests'), ('team_badges'), ('team_badge_awards'),
    ('team_events'), ('team_event_participants'), ('team_invites'),
    ('team_join_requests'),
    ('friendships'), ('follows'), ('user_presence'),
    ('team_live_sessions'), ('team_live_participants')
),
beklenen_fonksiyonlar(ad) as (
  values
    ('gen_team_code'), ('team_role'), ('is_team_member'), ('team_can'),
    ('team_stats'), ('sync_team_level'), ('evaluate_team_badges'),
    ('team_quest_progress'),
    ('are_friends'), ('friend_ids'), ('touch_presence'), ('end_live_session'),
    ('post_user_activity'), ('team_stats_series'), ('team_pulse'),
    ('is_team_media_member')
),
beklenen_sutunlar(ad) as (
  values
    ('logo_url'), ('cover_url'), ('city'), ('country'), ('visibility'),
    ('join_policy'), ('invite_code'), ('member_limit'), ('level'), ('rules'),
    ('updated_at')
),
beklenen_tetikleyiciler(ad) as (
  values
    ('trg_team_member_joined'), ('trg_activity_workout'),
    ('trg_activity_achievement'), ('trg_activity_gamification')
),
beklenen_realtime(ad) as (
  values
    ('team_messages'), ('team_posts'), ('team_post_reactions'),
    ('team_post_comments'), ('notifications'), ('team_live_sessions'),
    ('team_live_participants'), ('user_presence'), ('friendships'),
    ('team_quests'), ('team_events')
),

-- 1) Tablolar ---------------------------------------------------------------
r_tablo as (
  select
    1 as sira, 'Tablo' as kategori, b.ad as nesne,
    case when t.tablename is null then '✗ EKSİK' else '✓' end as durum,
    coalesce(
      (select case when c.relrowsecurity then 'RLS açık' else '! RLS KAPALI' end
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = b.ad),
      '—'
    ) as ayrinti
  from beklenen_tablolar b
  left join pg_tables t on t.schemaname = 'public' and t.tablename = b.ad
),

-- 2) Fonksiyonlar -----------------------------------------------------------
r_fonksiyon as (
  select
    2, 'Fonksiyon', b.ad,
    case when p.proname is null then '✗ EKSİK' else '✓' end,
    coalesce(count(p.proname)::text || ' aşırı yükleme', '—')
  from beklenen_fonksiyonlar b
  left join pg_proc p
    on p.proname = b.ad
   and p.pronamespace = (select oid from pg_namespace where nspname = 'public')
  group by b.ad, p.proname
),

-- 3) teams sütunları --------------------------------------------------------
r_sutun as (
  select
    3, 'teams sütunu', b.ad,
    case when c.column_name is null then '✗ EKSİK' else '✓' end,
    coalesce(c.data_type, '—')
  from beklenen_sutunlar b
  left join information_schema.columns c
    on c.table_schema = 'public' and c.table_name = 'teams' and c.column_name = b.ad
),

-- 4) Tetikleyiciler ---------------------------------------------------------
r_tetik as (
  select
    4, 'Tetikleyici', b.ad,
    case when t.tgname is null then '✗ EKSİK' else '✓' end,
    coalesce((select cl.relname from pg_class cl where cl.oid = t.tgrelid), '—')
  from beklenen_tetikleyiciler b
  left join pg_trigger t on t.tgname = b.ad and not t.tgisinternal
),

-- 5) Realtime yayını --------------------------------------------------------
r_realtime as (
  select
    5, 'Realtime', b.ad,
    case when pt.tablename is null then '✗ EKSİK' else '✓' end,
    coalesce(
      (select case when c.relreplident = 'f' then 'replica identity full'
                   else '! replica identity ' || c.relreplident::text end
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = b.ad),
      '—'
    )
  from beklenen_realtime b
  left join pg_publication_tables pt
    on pt.pubname = 'supabase_realtime' and pt.schemaname = 'public' and pt.tablename = b.ad
),

-- 6) Storage bucket ---------------------------------------------------------
r_bucket as (
  select
    6, 'Storage', 'team-media',
    case when b.id is null then '✗ EKSİK' else '✓' end,
    case when b.id is null then '—'
         when b.public then '! PUBLIC (özel olmalı)'
         else 'özel (doğru)' end
  from (select 1) x
  left join storage.buckets b on b.id = 'team-media'
),

-- 7) Rozet kataloğu ---------------------------------------------------------
r_rozet as (
  select
    7, 'Veri', 'team_badges kataloğu',
    case when count(*) >= 9 then '✓' else '✗ EKSİK' end,
    count(*)::text || ' rozet'
  from public.team_badges
),

-- 8) Storage politikaları ---------------------------------------------------
r_politika as (
  select
    8, 'Storage politikası', p.ad,
    case when x.policyname is null then '✗ EKSİK' else '✓' end, '—'
  from (values ('team_media_read'), ('team_media_insert'), ('team_media_delete')) p(ad)
  left join pg_policies x
    on x.schemaname = 'storage' and x.tablename = 'objects' and x.policyname = p.ad
)

select kategori, nesne, durum, ayrinti
from (
  select * from r_tablo
  union all select * from r_fonksiyon
  union all select * from r_sutun
  union all select * from r_tetik
  union all select * from r_realtime
  union all select * from r_bucket
  union all select * from r_rozet
  union all select * from r_politika
) q(sira, kategori, nesne, durum, ayrinti)
order by sira, nesne;
