-- ============================================================================
-- Migration 0032 — Oyunlaştırma (XP) sağlamlaştırma
-- Sorun: sync_gamification opsiyonel tabloları (ai_conversations,
-- posture_analyses, personal_records) doğrudan okuyordu. Bu tablolardan biri
-- kullanıcının DB'sinde yoksa fonksiyon çöküyor → XP HİÇ güncellenmiyordu.
-- Çözüm: opsiyonel okumaları to_regclass ile koru → eksik tablo = 0 sayılır,
-- XP (antrenman/su/protein/başarım) her koşulda hesaplanır. Idempotent.
-- ============================================================================

create or replace function public.sync_gamification(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_workouts int; v_volume numeric; v_pr int := 0; v_posture int := 0; v_ai int := 0;
  v_water_days int; v_protein_days int; v_active_days int; v_exercises int;
  v_water_goal int; v_protein_goal int;
  v_streak int := 0; v_longest int := 0; v_last date; v_prev date; d date;
  v_base_xp int := 0; v_ach_xp int := 0; v_total_xp int := 0;
  v_level int; v_prev_level int; v_fitness int;
  r_workout int; r_volume int; r_water int; r_protein int; r_pr int;
  r_posture int; r_ai int; r_login int;
  ach record; v_prog numeric; v_done boolean;
begin
  -- Hedefler
  select coalesce(daily_water_goal_ml, 2500), coalesce(daily_protein_goal, 120)
    into v_water_goal, v_protein_goal from public.profiles where id = p_user;
  v_water_goal := coalesce(v_water_goal, 2500);
  v_protein_goal := coalesce(v_protein_goal, 120);

  -- Aktivite sayaçları (çekirdek tablolar)
  select count(*) into v_workouts from public.workouts where user_id = p_user and status = 'completed';
  select coalesce(sum(coalesce(ws.reps,0) * coalesce(ws.weight_kg,0)), 0) into v_volume
    from public.workout_sets ws join public.workouts w on w.id = ws.workout_id
    where w.user_id = p_user and ws.completed;
  select count(*) into v_exercises from public.workout_sets ws
    join public.workouts w on w.id = ws.workout_id where w.user_id = p_user and ws.completed;

  -- Opsiyonel tablolar — yoksa 0 (fonksiyon çökmez)
  if to_regclass('public.personal_records') is not null then
    execute 'select count(*) from public.personal_records where user_id = $1' into v_pr using p_user;
  end if;
  if to_regclass('public.posture_analyses') is not null then
    execute 'select count(*) from public.posture_analyses where user_id = $1' into v_posture using p_user;
  end if;
  if to_regclass('public.ai_conversations') is not null then
    execute 'select count(*) from public.ai_conversations where user_id = $1' into v_ai using p_user;
  end if;

  select count(*) into v_water_days from (
    select log_date from public.water_logs where user_id = p_user
    group by log_date having sum(amount_ml) >= v_water_goal
  ) t;
  select count(*) into v_protein_days from (
    select log_date from public.nutrition_logs where user_id = p_user
    group by log_date having sum(protein_g) >= v_protein_goal
  ) t;

  -- Aktif gün seti (streak için). NOT: kolon adı 'dd' — döngüler bununla eşleşir.
  drop table if exists _gam_days;
  create temp table _gam_days (dd date primary key) on commit drop;
  insert into _gam_days (dd)
    select distinct dd from (
      select workout_date dd from public.workouts where user_id = p_user and status = 'completed'
      union select log_date from public.water_logs where user_id = p_user
      union select log_date from public.nutrition_logs where user_id = p_user
    ) s where dd is not null
  on conflict do nothing;

  select count(*) into v_active_days from _gam_days;

  -- Streak
  v_prev := null;
  for d in select dd from _gam_days order by dd loop
    if v_prev is null or d = v_prev + 1 then v_streak := v_streak + 1;
    elsif d <> v_prev then v_streak := 1; end if;
    if v_streak > v_longest then v_longest := v_streak; end if;
    v_last := d; v_prev := d;
  end loop;
  if v_last is null or v_last < current_date - 1 then v_streak := 0;
  else
    v_streak := 0; v_prev := null;
    for d in select dd from _gam_days order by dd loop
      if v_prev is null or d = v_prev + 1 then v_streak := v_streak + 1;
      elsif d <> v_prev then v_streak := 1; end if;
      v_prev := d;
    end loop;
  end if;

  -- XP kuralları (yoksa varsayılan)
  select coalesce((select xp from public.xp_rules where event_key='workout_completed' and enabled),20) into r_workout;
  select coalesce((select xp from public.xp_rules where event_key='volume_1000kg' and enabled),5) into r_volume;
  select coalesce((select xp from public.xp_rules where event_key='water_goal' and enabled),10) into r_water;
  select coalesce((select xp from public.xp_rules where event_key='protein_goal' and enabled),10) into r_protein;
  select coalesce((select xp from public.xp_rules where event_key='new_pr' and enabled),25) into r_pr;
  select coalesce((select xp from public.xp_rules where event_key='first_posture' and enabled),40) into r_posture;
  select coalesce((select xp from public.xp_rules where event_key='ai_coach_used' and enabled),5) into r_ai;
  select coalesce((select xp from public.xp_rules where event_key='daily_login' and enabled),5) into r_login;

  v_base_xp :=
      v_workouts * r_workout
    + floor(v_volume / 1000)::int * r_volume
    + v_water_days * r_water
    + v_protein_days * r_protein
    + v_pr * r_pr
    + (case when v_posture > 0 then r_posture else 0 end)
    + v_ai * r_ai
    + v_active_days * r_login;

  -- Başarımlar
  for ach in select * from public.achievements where enabled loop
    v_prog := case ach.metric
      when 'workouts_count' then v_workouts
      when 'total_volume'   then v_volume
      when 'exercises_count' then v_exercises
      when 'posture_count'  then v_posture
      when 'ai_count'       then v_ai
      when 'pr_count'       then v_pr
      when 'water_days'     then v_water_days
      when 'protein_days'   then v_protein_days
      when 'streak_days'    then greatest(v_longest, v_streak)
      when 'active_days'    then v_active_days
      else 0 end;
    v_done := v_prog >= ach.target;
    insert into public.achievement_progress (user_id, achievement_id, progress, target, completed, completed_at, updated_at)
    values (p_user, ach.id, v_prog, ach.target, v_done, case when v_done then now() else null end, now())
    on conflict (user_id, achievement_id) do update set
      progress = excluded.progress, target = excluded.target, completed = excluded.completed,
      completed_at = coalesce(public.achievement_progress.completed_at, excluded.completed_at), updated_at = now();
    if v_done then v_ach_xp := v_ach_xp + ach.xp_reward; end if;
  end loop;

  v_total_xp := v_base_xp + v_ach_xp;
  v_level := public.gam_level_for_xp(v_total_xp);

  v_fitness := least(100, (
      least(30, v_workouts * 2) + least(15, v_protein_days) + least(15, v_water_days)
    + least(15, v_active_days) + least(10, floor(v_volume/2000)::int)
    + (case when v_posture > 0 then 10 else 0 end) + least(5, v_ai)));

  select level into v_prev_level from public.user_gamification where user_id = p_user;

  insert into public.user_gamification
    (user_id, total_xp, level, fitness_score, current_streak, longest_streak, last_active_on, season_xp, updated_at)
  values (p_user, v_total_xp, v_level, v_fitness, v_streak, v_longest, v_last, v_total_xp, now())
  on conflict (user_id) do update set
    total_xp = excluded.total_xp, level = excluded.level, fitness_score = excluded.fitness_score,
    current_streak = excluded.current_streak, longest_streak = excluded.longest_streak,
    last_active_on = excluded.last_active_on, season_xp = excluded.season_xp, updated_at = now();

  insert into public.streaks (user_id, kind, current, longest, last_date, updated_at)
  values (p_user, 'daily', v_streak, v_longest, v_last, now())
  on conflict (user_id, kind) do update set
    current = excluded.current, longest = greatest(public.streaks.longest, excluded.longest),
    last_date = excluded.last_date, updated_at = now();

  insert into public.fitness_scores (user_id, score_date, score, breakdown)
  values (p_user, current_date, v_fitness, jsonb_build_object(
    'workouts', v_workouts, 'volume', v_volume, 'water_days', v_water_days,
    'protein_days', v_protein_days, 'active_days', v_active_days, 'posture', v_posture, 'ai', v_ai))
  on conflict (user_id, score_date) do update set score = excluded.score, breakdown = excluded.breakdown;

  return jsonb_build_object(
    'total_xp', v_total_xp, 'level', v_level, 'prev_level', coalesce(v_prev_level, 1),
    'leveled_up', coalesce(v_prev_level, 1) < v_level,
    'fitness_score', v_fitness, 'current_streak', v_streak, 'longest_streak', v_longest);
end;
$$;

grant execute on function public.sync_gamification(uuid) to authenticated, service_role;
