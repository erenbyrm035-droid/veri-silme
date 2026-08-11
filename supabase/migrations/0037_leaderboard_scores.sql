-- ============================================================================
-- Migration 0037 — Leaderboard dönemsel skor motoru
--
-- SORUN: Haftalık/Aylık/Yıllık sıralamalar boştu. Çünkü bu dönemler xp_logs
-- tablosundan okunuyordu; ancak XP'yi asıl üreten sync_gamification() fonksiyonu
-- yalnızca user_gamification.total_xp'yi güncelliyor, xp_logs'a satır YAZMIYOR
-- (xp_logs sadece award_xp() ile dolar ve pratikte boş kalıyor).
--
-- ÇÖZÜM: Dönemsel XP'yi gerçek aktiviteden (antrenman, hacim, su, protein, PR,
-- postür, AI) xp_rules katsayılarıyla hesaplayan set-tabanlı bir fonksiyon.
-- Varsa xp_logs kayıtları da eklenir (çift sayım olmaz: xp_logs ayrı kaynak
-- değil, award_xp ile verilmiş ekstra XP'dir ve pratikte boştur).
--
-- Additive + idempotent.
-- ============================================================================

-- Performans: dönem filtreleri için indeksler
create index if not exists idx_workouts_user_date_status
  on public.workouts (user_id, workout_date) where status = 'completed';
create index if not exists idx_water_logs_user_date  on public.water_logs (user_id, log_date);
create index if not exists idx_nutrition_logs_user_date on public.nutrition_logs (user_id, log_date);
create index if not exists idx_prs_user_date on public.personal_records (user_id, achieved_on);

-- ---------------------------------------------------------------------------
-- leaderboard_scores(p_start, p_end)
--   p_start null  → tüm zamanlar (user_gamification.total_xp)
--   aksi halde    → [p_start, p_end] penceresindeki aktiviteden hesaplanan XP
-- ---------------------------------------------------------------------------
create or replace function public.leaderboard_scores(
  p_start date default null,
  p_end   date default null
)
returns table (user_id uuid, score bigint, level int, streak int)
language plpgsql stable security definer set search_path = public as $$
declare
  r_workout int; r_volume int; r_water int; r_protein int;
  r_pr int; r_posture int; r_ai int;
  v_end date := coalesce(p_end, current_date);
begin
  -- Tüm zamanlar: hazır toplam
  if p_start is null then
    return query
      select g.user_id, g.total_xp::bigint, g.level, g.current_streak
      from public.user_gamification g
      where g.total_xp > 0;
    return;
  end if;

  -- XP kuralları (yoksa sync_gamification ile aynı varsayılanlar)
  select coalesce((select xp from public.xp_rules where event_key='workout_completed' and enabled), 20) into r_workout;
  select coalesce((select xp from public.xp_rules where event_key='volume_1000kg'     and enabled),  5) into r_volume;
  select coalesce((select xp from public.xp_rules where event_key='water_goal'        and enabled), 10) into r_water;
  select coalesce((select xp from public.xp_rules where event_key='protein_goal'      and enabled), 10) into r_protein;
  select coalesce((select xp from public.xp_rules where event_key='new_pr'            and enabled), 25) into r_pr;
  select coalesce((select xp from public.xp_rules where event_key='first_posture'     and enabled), 40) into r_posture;
  select coalesce((select xp from public.xp_rules where event_key='ai_coach_used'     and enabled),  5) into r_ai;

  return query
  with
  -- Kullanıcı hedefleri (su/protein günü sayımı için)
  goals as (
    select p.id as uid,
           coalesce(p.daily_water_goal_ml, 2500) as water_goal,
           coalesce(p.daily_protein_goal, 120)   as protein_goal
    from public.profiles p
  ),
  -- Tamamlanan antrenmanlar
  w as (
    select o.user_id as uid, count(*)::int as n
    from public.workouts o
    where o.status = 'completed' and o.workout_date between p_start and v_end
    group by o.user_id
  ),
  -- Kaldırılan hacim (kg)
  vol as (
    select o.user_id as uid,
           coalesce(sum(coalesce(s.reps,0) * coalesce(s.weight_kg,0)), 0) as kg
    from public.workout_sets s
    join public.workouts o on o.id = s.workout_id
    where s.completed and o.workout_date between p_start and v_end
    group by o.user_id
  ),
  -- Su hedefi tutturulan gün sayısı
  wat as (
    select d.user_id as uid, count(*)::int as n
    from (
      select l.user_id, l.log_date, sum(l.amount_ml) as ml
      from public.water_logs l
      where l.log_date between p_start and v_end
      group by l.user_id, l.log_date
    ) d
    join goals g on g.uid = d.user_id
    where d.ml >= g.water_goal
    group by d.user_id
  ),
  -- Protein hedefi tutturulan gün sayısı
  pro as (
    select d.user_id as uid, count(*)::int as n
    from (
      select l.user_id, l.log_date, sum(l.protein_g) as p
      from public.nutrition_logs l
      where l.log_date between p_start and v_end
      group by l.user_id, l.log_date
    ) d
    join goals g on g.uid = d.user_id
    where d.p >= g.protein_goal
    group by d.user_id
  ),
  -- Kişisel rekorlar
  pr as (
    select r.user_id as uid, count(*)::int as n
    from public.personal_records r
    where r.achieved_on between p_start and v_end
    group by r.user_id
  ),
  -- Postür analizleri
  pos as (
    select a.user_id as uid, count(*)::int as n
    from public.posture_analyses a
    where a.created_at >= p_start::timestamptz
      and a.created_at < (v_end + 1)::timestamptz
    group by a.user_id
  ),
  -- AI sohbetleri
  ai as (
    select c.user_id as uid, count(*)::int as n
    from public.ai_conversations c
    where c.created_at >= p_start::timestamptz
      and c.created_at < (v_end + 1)::timestamptz
    group by c.user_id
  ),
  -- award_xp ile verilmiş ek XP (varsa)
  logs as (
    select x.user_id as uid, coalesce(sum(x.xp), 0)::bigint as xp
    from public.xp_logs x
    where x.created_at >= p_start::timestamptz
      and x.created_at < (v_end + 1)::timestamptz
    group by x.user_id
  ),
  -- Puanı olan tüm kullanıcılar
  ids as (
    select uid from w
    union select uid from vol
    union select uid from wat
    union select uid from pro
    union select uid from pr
    union select uid from pos
    union select uid from ai
    union select uid from logs
  )
  select
    i.uid,
    (
      coalesce(w.n, 0)   * r_workout
    + floor(coalesce(vol.kg, 0) / 1000)::int * r_volume
    + coalesce(wat.n, 0) * r_water
    + coalesce(pro.n, 0) * r_protein
    + coalesce(pr.n, 0)  * r_pr
    + coalesce(pos.n, 0) * r_posture
    + coalesce(ai.n, 0)  * r_ai
    + coalesce(logs.xp, 0)
    )::bigint as score,
    coalesce(g.level, 1) as level,
    coalesce(g.current_streak, 0) as streak
  from ids i
  left join w    on w.uid   = i.uid
  left join vol  on vol.uid = i.uid
  left join wat  on wat.uid = i.uid
  left join pro  on pro.uid = i.uid
  left join pr   on pr.uid  = i.uid
  left join pos  on pos.uid = i.uid
  left join ai   on ai.uid  = i.uid
  left join logs on logs.uid = i.uid
  left join public.user_gamification g on g.user_id = i.uid;
end $$;

grant execute on function public.leaderboard_scores(date, date) to authenticated, service_role;
