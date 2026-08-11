-- ===========================================================================
-- AI AGENT DOĞRULAMA (migration 0046)
--
-- SALT OKUNUR — hiçbir veriyi değiştirmez, silmez, eklemez.
-- Supabase → SQL Editor'e yapıştır, çalıştır.
--
-- ÖNEMLİ: Supabase SQL Editor yalnızca SON sorgunun sonucunu gösterir.
-- Bu yüzden tüm kontroller TEK sorguda birleştirildi — hepsini birden
-- görebilmen için. `durum` sütununda tek bir "KALDI" olmamalı.
--
-- 0046_ai_agent.sql'i çalıştırdıktan SONRA bunu çalıştır.
-- ===========================================================================

with

-- --- 1) Yeni tablolar -----------------------------------------------------
t_tablo as (
  select 1 as sira, 'Tablo' as grup, x.ad as kontrol,
         (to_regclass('public.' || x.ad) is not null) as ok,
         'tablo oluşmamış' as hata
  from (values ('ai_facts'), ('ai_goals'), ('ai_reports'), ('ai_actions')) as x(ad)
),

-- --- 2) Yeni fonksiyonlar -------------------------------------------------
t_fn as (
  select 2, 'Fonksiyon', x.ad,
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = x.ad),
         'fonksiyon oluşmamış'
  from (values
    ('upsert_ai_fact'), ('expire_ai_facts'), ('goal_current_value'),
    ('goal_progress'), ('evaluate_ai_goals'), ('agent_snapshot')
  ) as x(ad)
),

-- --- 3) RLS açık mı (en kritik güvenlik kontrolü) -------------------------
t_rls as (
  select 3, 'RLS açık', x.ad,
         coalesce((select c.relrowsecurity from pg_class c
                    join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relname = x.ad), false),
         'RLS KAPALI — veri herkese açık!'
  from (values ('ai_facts'), ('ai_goals'), ('ai_reports'), ('ai_actions')) as x(ad)
),

-- --- 4) RLS politikaları --------------------------------------------------
t_pol as (
  select 4, 'Politika', x.ad,
         exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = x.ad and policyname = x.ad || '_own'),
         'politika yok — RLS açık ama kural tanımsız'
  from (values ('ai_facts'), ('ai_goals'), ('ai_reports'), ('ai_actions')) as x(ad)
),

-- --- 5) Veri bütünlüğü kısıtları -----------------------------------------
t_chk as (
  select 5, 'Kısıt', x.ad,
         exists (select 1 from pg_constraint where conname = x.ad),
         'kısıt yok — geçersiz veri girebilir'
  from (values
    ('ai_facts_confidence_chk'), ('ai_goals_direction_chk'),
    ('ai_goals_status_chk'), ('ai_reports_kind_chk'), ('ai_actions_status_chk')
  ) as x(ad)
),

-- --- 6) Tekillik (aynı kayıt iki kez oluşmasın) ---------------------------
t_uniq as (
  select 6, 'Tekillik', x.aciklama,
         exists (select 1 from pg_indexes
                  where schemaname = 'public' and tablename = x.tablo
                    and indexdef ilike '%UNIQUE%' and indexdef ilike x.kolonlar),
         'tekillik yok — kayıt çoğalabilir'
  from (values
    ('ai_facts: kullanıcı + anahtar',        'ai_facts',   '%(user_id, key)%'),
    ('ai_reports: kullanıcı + tür + tarih',  'ai_reports', '%(user_id, kind, report_date)%')
  ) as x(aciklama, tablo, kolonlar)
),

-- --- 7) agent_snapshot gerçekten çalışıyor mu -----------------------------
-- Var olmayan kullanıcı ile çağırıyoruz: yeni kayıt olmuş, hiç verisi
-- olmayan kullanıcıda da çökmemeli.
snap as (
  select public.agent_snapshot('00000000-0000-0000-0000-000000000000'::uuid) as v
),
t_snap as (
  select 7, 'Snapshot', 'boş kullanıcıda çökmüyor',
         (select v is not null from snap),
         'agent_snapshot çalışmıyor'
  union all
  select 7, 'Snapshot bölümü', x.ad,
         (select v ? x.ad from snap),
         'bölüm eksik — koç bu veriyi göremez'
  from (values
    ('profile'), ('today'), ('gamification'), ('season'), ('social'),
    ('challenges'), ('goals'), ('facts'), ('recent_workouts'),
    ('monthly'), ('nutrition_7d')
  ) as x(ad)
),

-- --- 8) Kilo hedefi düzeltmesi uygulanmış mı ------------------------------
-- Kullanıcıların çoğu İlerleme sayfasına ölçüm girmiyor; kilo onboarding'de
-- profiles.weight_kg'ye yazılıyor. Fonksiyon sadece body_measurements'a
-- bakarsa kilo hedeflerinde ilerleme HİÇ hesaplanmaz ve sapma uyarısı
-- HİÇ üretilmez — özellik sessizce çalışmaz.
t_fix as (
  select 8, 'Düzeltme', 'kilo hedefi profiles''a geri düşüyor',
         coalesce((
           select pg_get_functiondef(p.oid) ilike '%coalesce%'
              and pg_get_functiondef(p.oid) ilike '%profiles p where p.id = p_user)%'
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'goal_current_value'
         ), false),
         'eski sürüm — 0046 dosyasını tekrar çalıştır'
),

-- --- 9) Mevcut sistem bozulmamış mı --------------------------------------
-- 0046 additive olmalı. Eski AI tabloları ve RPC'ler yerinde durmalı.
t_eski as (
  select 9, 'Eski tablo', x.ad,
         (to_regclass('public.' || x.ad) is not null),
         'ESKİ TABLO KAYBOLMUŞ — veri kaybı!'
  from (values
    ('ai_memory'), ('ai_conversations'), ('ai_messages'),
    ('ai_usage'), ('ai_logs'), ('ai_prompt_versions')
  ) as x(ad)
  union all
  select 9, 'Eski RPC', x.ad,
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = x.ad),
         'ESKİ RPC KAYBOLMUŞ — sayfalar bozulur!'
  from (values
    ('daily_summary'), ('recovery_score'), ('readiness_score'),
    ('insights_snapshot'), ('season_state'), ('sync_gamification')
  ) as x(ad)
),

hepsi as (
  select * from t_tablo
  union all select * from t_fn
  union all select * from t_rls
  union all select * from t_pol
  union all select * from t_chk
  union all select * from t_uniq
  union all select * from t_snap
  union all select * from t_fix
  union all select * from t_eski
)

-- ---------------------------------------------------------------------------
-- SONUÇ: en üstte genel özet, altında tek tek kontroller.
-- ---------------------------------------------------------------------------
select
  case when h.ok then '✅ GEÇTİ' else '❌ KALDI' end as durum,
  h.grup,
  h.kontrol,
  case when h.ok then '' else h.hata end as aciklama
from hepsi h

union all

select
  case when (select bool_and(ok) from hepsi) then '🎉 TÜMÜ GEÇTİ' else '⛔ SORUN VAR' end,
  'ÖZET',
  (select count(*) filter (where ok) from hepsi)::text || ' / ' ||
  (select count(*) from hepsi)::text || ' kontrol geçti',
  case when (select bool_and(ok) from hepsi)
       then 'Agent kurulumu tamam. Koç artık araç kullanabilir.'
       else 'Yukarıdaki KALDI satırlarına bak.' end

order by 1 desc, 2, 3;
