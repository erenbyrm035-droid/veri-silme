-- ============================================================================
-- Migration 0040 — Coin ekonomisi + Dalga 0 düzeltmeleri
--
-- SORUN: `user_gamification.coins` hiçbir yerde ARTMIYOR. `sync_gamification()`
-- coins sütununa hiç dokunmuyor; yalnızca `claimReward()` azaltıyor. Yani ödül
-- kataloğu (reward_catalog / reward_claims) matematiksel olarak kullanılamaz —
-- herkesin bakiyesi sonsuza kadar 0.
--
-- ÇÖZÜM: 190 satırlık `sync_gamification()` fonksiyonuna dokunmadan, additive bir
-- BEFORE trigger ile coin bakiyesini türetiyoruz:
--
--     coins = coins_earned - coins_spent
--
-- `coins_earned` yaşam boyu başarımdan deterministik olarak hesaplanır (yeniden
-- hesaplanabilir, idempotent). `coins_spent` yalnızca harcama ile artar.
-- Böylece sync her çalıştığında bakiye doğru kalır ve harcamalar kaybolmaz.
--
-- Additive + idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Coin muhasebesi sütunları
-- ---------------------------------------------------------------------------
alter table public.user_gamification
  add column if not exists coins_earned int not null default 0,
  add column if not exists coins_spent  int not null default 0;

comment on column public.user_gamification.coins_earned is
  'Yaşam boyu kazanılan coin (XP + başarım + görevden türetilir, yeniden hesaplanabilir).';
comment on column public.user_gamification.coins_spent is
  'Yaşam boyu harcanan coin. Yalnızca spend_coins() artırır.';

-- ---------------------------------------------------------------------------
-- 2) Kazanç formülü
--    10 XP = 1 coin · tamamlanan başarım = +25 · tamamlanan haftalık görev = +15
-- ---------------------------------------------------------------------------
create or replace function public.coins_earned_for(p_user uuid, p_total_xp int)
returns int language sql stable security definer set search_path = public as $$
  select greatest(0, floor(coalesce(p_total_xp, 0) / 10.0)::int)
       + 25 * coalesce((
           select count(*)::int from public.achievement_progress ap
            where ap.user_id = p_user and ap.completed
         ), 0)
       + 15 * coalesce((
           select count(*)::int from public.challenge_progress cp
            where cp.user_id = p_user and cp.completed
         ), 0);
$$;

-- ---------------------------------------------------------------------------
-- 3) Bakiyeyi otomatik türeten trigger
--    sync_gamification() total_xp'yi her güncellediğinde burası devreye girer.
-- ---------------------------------------------------------------------------
create or replace function public.tg_user_gamification_coins() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.coins_earned := public.coins_earned_for(new.user_id, new.total_xp);
  new.coins := greatest(0, new.coins_earned - coalesce(new.coins_spent, 0));
  return new;
end $$;

drop trigger if exists trg_user_gamification_coins on public.user_gamification;
create trigger trg_user_gamification_coins
  before insert or update on public.user_gamification
  for each row execute function public.tg_user_gamification_coins();

-- ---------------------------------------------------------------------------
-- 4) Atomik harcama
--    Yarış koşulu yok: tek UPDATE, bakiye yetersizse satır güncellenmez.
-- ---------------------------------------------------------------------------
create or replace function public.spend_coins(p_user uuid, p_amount int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ok boolean := false;
begin
  if coalesce(p_amount, 0) <= 0 then return true; end if;

  update public.user_gamification g
     set coins_spent = g.coins_spent + p_amount,
         updated_at  = now()
   where g.user_id = p_user
     and (g.coins_earned - g.coins_spent) >= p_amount
  returning true into v_ok;

  return coalesce(v_ok, false);
end $$;

/** Harcamayı geri alır (ödül talebi başarısız olursa). */
create or replace function public.refund_coins(p_user uuid, p_amount int)
returns void language sql security definer set search_path = public as $$
  update public.user_gamification
     set coins_spent = greatest(0, coins_spent - greatest(0, coalesce(p_amount, 0))),
         updated_at = now()
   where user_id = p_user;
$$;

-- ---------------------------------------------------------------------------
-- 5) Geriye dönük doldurma
--    a) Mevcut ödül taleplerini harcama olarak say (çift harcama olmasın)
--    b) Tüm satırlarda trigger'ı tetikleyerek bakiyeleri hesapla
-- ---------------------------------------------------------------------------
update public.user_gamification g
   set coins_spent = coalesce((
         select sum(rc.cost_coins)::int
           from public.reward_claims cl
           join public.reward_catalog rc on rc.id = cl.reward_id
          where cl.user_id = g.user_id
       ), 0)
 where g.coins_spent = 0;

-- Trigger BEFORE UPDATE olduğu için bu dokunuş bakiyeleri yeniden hesaplar.
update public.user_gamification set updated_at = now();

-- ---------------------------------------------------------------------------
-- 6) B7 — challenge_progress okunabilir olsun
--    getWeeklyChallenges() ilerlemeyi sıfırdan hesaplıyordu; sticky "tamamlandı"
--    bilgisi UI'da kayboluyordu. Bu görünüm tek sorguda doğru veriyi verir.
-- ---------------------------------------------------------------------------
create or replace function public.my_weekly_challenges(p_user uuid)
returns table (
  id uuid, key text, title text, description text, metric text, icon text,
  target numeric, xp_reward int, week_start date,
  progress numeric, completed boolean, completed_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select wc.id, wc.key, wc.title, wc.description, wc.metric, wc.icon,
         wc.target, wc.xp_reward, wc.week_start,
         coalesce(cp.progress, 0)::numeric as progress,
         coalesce(cp.completed, false)     as completed,
         cp.completed_at
    from public.weekly_challenges wc
    left join public.challenge_progress cp
           on cp.challenge_id = wc.id and cp.user_id = p_user
   where wc.active
     and wc.week_start = date_trunc('week', current_date)::date
   order by wc.created_at;
$$;

-- ---------------------------------------------------------------------------
-- 7) Yetkiler
-- ---------------------------------------------------------------------------
grant execute on function public.coins_earned_for(uuid, int)   to authenticated, service_role;
grant execute on function public.spend_coins(uuid, int)        to service_role;
grant execute on function public.refund_coins(uuid, int)       to service_role;
grant execute on function public.my_weekly_challenges(uuid)    to authenticated, service_role;
