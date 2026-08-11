-- ============================================================================
-- Migration 0042 — AI içgörü anlık görüntüsü
--
-- SORUN: `ai_memory` yalnızca geçmiş sohbetin ham metnini (son 800 karakter)
-- tutuyor. AI'ın "Son 10 gündür protein hedefini kaçırıyorsun", "Bu hafta
-- hacmin %18 arttı" gibi cümleler kurabilmesi için VERİDEN TÜRETİLMİŞ sayısal
-- bulgulara ihtiyacı var.
--
-- ÇÖZÜM: Tek çağrıda tüm bulguları üreten `insights_snapshot()`. Uygulama
-- katmanı bunu cümleye çevirir (src/lib/ai/insights.ts).
--
-- Additive + idempotent. Not: OUT parametre adları tablo kolonlarıyla
-- çakışmasın diye tüm ara değerler v_ önekli değişkenlerde tutulur.
-- ============================================================================

create or replace function public.insights_snapshot(p_user uuid)
returns table (
  vol_this_week   numeric,   -- son 7 gün kaldırılan hacim (kg)
  vol_prev_week   numeric,   -- önceki 7 gün
  workouts_week   int,
  workouts_prev   int,
  minutes_week    int,
  protein_miss_streak int,   -- kaç gündür protein hedefi kaçıyor
  water_miss_streak   int,
  active_streak   int,
  last_workout_days int,     -- son antrenmandan bu yana geçen gün
  weight_delta_30 numeric,   -- 30 günlük kilo değişimi
  pr_count_30     int,
  top_muscle      text,      -- son 30 günde en çok çalışılan bölge
  lagging_muscle  text,      -- en az çalışılan (ihmal edilen) bölge
  fav_exercise    text,
  sleep_avg_7     int,
  steps_avg_7     int
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_vol_now numeric := 0; v_vol_prev numeric := 0;
  v_wo_now int := 0; v_wo_prev int := 0; v_min_now int := 0;
  v_prot_goal int; v_water_goal int;
  v_prot_miss int := 0; v_water_miss int := 0;
  v_streak int := 0; v_last_days int;
  v_w_delta numeric; v_pr int := 0;
  v_top text; v_lag text; v_fav text;
  v_sleep int := 0; v_steps int := 0;
  v_d date; v_got numeric;
begin
  select coalesce(daily_protein_goal, 120), coalesce(daily_water_goal_ml, 2500)
    into v_prot_goal, v_water_goal
    from public.profiles where id = p_user;
  v_prot_goal := coalesce(v_prot_goal, 120);
  v_water_goal := coalesce(v_water_goal, 2500);

  -- Hacim + antrenman sayısı (bu hafta / önceki hafta)
  select coalesce(sum(coalesce(s.reps,0) * coalesce(s.weight_kg,0)), 0)
    into v_vol_now
    from public.workout_sets s join public.workouts o on o.id = s.workout_id
   where o.user_id = p_user and s.completed and o.workout_date >= current_date - 6;

  select coalesce(sum(coalesce(s.reps,0) * coalesce(s.weight_kg,0)), 0)
    into v_vol_prev
    from public.workout_sets s join public.workouts o on o.id = s.workout_id
   where o.user_id = p_user and s.completed
     and o.workout_date between current_date - 13 and current_date - 7;

  select count(*)::int, coalesce(sum(o.duration_min), 0)::int
    into v_wo_now, v_min_now
    from public.workouts o
   where o.user_id = p_user and o.status = 'completed' and o.workout_date >= current_date - 6;

  select count(*)::int into v_wo_prev
    from public.workouts o
   where o.user_id = p_user and o.status = 'completed'
     and o.workout_date between current_date - 13 and current_date - 7;

  -- Protein hedefi kaç gündür üst üste kaçıyor (dünden geriye).
  -- ÖNEMLİ: Kayıt GİRİLMEMİŞ gün "kaçırma" sayılmaz — aksi halde hiç kayıt
  -- tutmamış yeni bir kullanıcıya "30 gündür hedefini kaçırıyorsun" denirdi.
  -- Kayıt olmayan ilk günde döngü durur.
  v_d := current_date - 1;
  loop
    exit when v_d < current_date - 30;
    select coalesce(sum(l.protein_g), 0) into v_got
      from public.nutrition_logs l where l.user_id = p_user and l.log_date = v_d;
    exit when not exists (
      select 1 from public.nutrition_logs l where l.user_id = p_user and l.log_date = v_d
    );
    exit when v_got >= v_prot_goal;
    v_prot_miss := v_prot_miss + 1;
    v_d := v_d - 1;
  end loop;

  -- Su hedefi kaç gündür kaçıyor (aynı kural)
  v_d := current_date - 1;
  loop
    exit when v_d < current_date - 30;
    select coalesce(sum(l.amount_ml), 0) into v_got
      from public.water_logs l where l.user_id = p_user and l.log_date = v_d;
    exit when not exists (
      select 1 from public.water_logs l where l.user_id = p_user and l.log_date = v_d
    );
    exit when v_got >= v_water_goal;
    v_water_miss := v_water_miss + 1;
    v_d := v_d - 1;
  end loop;

  select current_streak into v_streak from public.user_gamification where user_id = p_user;

  select (current_date - max(o.workout_date))::int into v_last_days
    from public.workouts o where o.user_id = p_user and o.status = 'completed';

  -- 30 günlük kilo değişimi
  select (
    (select b.weight_kg from public.body_measurements b
      where b.user_id = p_user and b.weight_kg is not null
      order by b.measured_on desc limit 1)
    -
    (select b.weight_kg from public.body_measurements b
      where b.user_id = p_user and b.weight_kg is not null
        and b.measured_on <= current_date - 30
      order by b.measured_on desc limit 1)
  ) into v_w_delta;

  select count(*)::int into v_pr
    from public.personal_records r
   where r.user_id = p_user and r.achieved_on >= current_date - 29;

  -- Kas grubu dağılımı (son 30 gün, set sayısına göre)
  select mg into v_top from (
    select e.muscle_group mg, count(*) c
      from public.workout_sets s
      join public.workouts o on o.id = s.workout_id
      join public.exercises e on e.id = s.exercise_id
     where o.user_id = p_user and s.completed and o.workout_date >= current_date - 29
       and e.muscle_group is not null
     group by e.muscle_group order by c desc limit 1
  ) q;

  -- İhmal edilen bölge: kullanıcının hiç/az çalıştığı, katalogda var olan grup
  select mg into v_lag from (
    select e.muscle_group mg, count(s.id) c
      from public.exercises e
      left join public.workout_sets s
        on s.exercise_id = e.id and s.completed
       and exists (
         select 1 from public.workouts o
          where o.id = s.workout_id and o.user_id = p_user
            and o.workout_date >= current_date - 29)
     where e.muscle_group is not null
     group by e.muscle_group order by c asc, e.muscle_group limit 1
  ) q2;

  select exercise_name into v_fav from (
    select s.exercise_name, count(*) c
      from public.workout_sets s join public.workouts o on o.id = s.workout_id
     where o.user_id = p_user and s.completed and o.workout_date >= current_date - 59
     group by s.exercise_name order by c desc limit 1
  ) q3;

  select coalesce(round(avg(m.sleep_minutes)), 0)::int into v_sleep
    from public.daily_metrics m
   where m.user_id = p_user and m.sleep_minutes is not null and m.metric_date >= current_date - 6;

  select coalesce(round(avg(m.steps)), 0)::int into v_steps
    from public.daily_metrics m
   where m.user_id = p_user and m.steps is not null and m.metric_date >= current_date - 6;

  return query select
    v_vol_now, v_vol_prev, v_wo_now, v_wo_prev, v_min_now,
    v_prot_miss, v_water_miss, coalesce(v_streak, 0), v_last_days,
    v_w_delta, v_pr, v_top, v_lag, v_fav,
    coalesce(v_sleep, 0), coalesce(v_steps, 0);
end $$;

grant execute on function public.insights_snapshot(uuid) to authenticated, service_role;
