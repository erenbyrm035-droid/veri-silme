import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rememberFact, forgetFact, canonicalKey } from "./facts";
import type { ToolRisk } from "./types";
import type { ToolDefinition } from "@/lib/ai/provider";

// ============================================================================
// AGENT ARAÇ KAYIT DEFTERİ
//
// Agent'ı chatbot'tan ayıran şey burası: model artık sadece metin üretmiyor,
// uygulamanın verisini OKUYABİLİYOR ve (izinli olduğu ölçüde) DEĞİŞTİREBİLİYOR.
//
// ÜÇ RİSK SEVİYESİ — bu ayrım güvenliğin temeli:
//
//   read      → sadece okur. Serbestçe çalışır.
//   write     → küçük, geri alınabilir yazma (su kaydı, hedef, hatırlatma).
//               Doğrudan çalışır, `ai_actions`'a 'executed' olarak yazılır.
//   sensitive → kullanıcının PLANINI değiştirir (makro hedefleri, program
//               yoğunluğu). ÇALIŞTIRILMAZ; `ai_actions`'a 'proposed' olarak
//               yazılır ve kullanıcı tek dokunuşla onaylar.
//
// NEDEN ONAY: Bir dil modelinin kullanıcıya sormadan kalori hedefini
// değiştirmesi kabul edilemez — model yanlış anlarsa kullanıcı haftalarca
// yanlış hedefle beslenir. Okuma serbest, plan değişikliği onaylı.
//
// TÜM YAZMALAR RLS ALTINDA: `createClient()` (çerez oturumu) kullanılıyor,
// `createAdminClient()` DEĞİL. Yani araç bir hata yapsa bile başka kullanıcının
// verisine dokunamaz — veritabanı seviyesinde imkânsız.
// ============================================================================

export interface ToolContext {
  userId: string;
  conversationId?: string;
}

export interface ToolOutcome {
  ok: boolean;
  /** Modele geri beslenecek metin. Kısa ve olgusal olmalı. */
  content: string;
  /** `ai_actions.result` olarak saklanır. */
  result?: Record<string, unknown>;
  /** Kullanıcıya gösterilecek tek satırlık özet. */
  summary?: string;
}

export interface AgentTool<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  risk: ToolRisk;
  schema: S;
  /** Modele verilen JSON Schema. */
  parameters: Record<string, unknown>;
  /** `sensitive` araçlarda onay kartında görünecek metin. */
  proposal?: (args: z.infer<S>) => string;
  run: (ctx: ToolContext, args: z.infer<S>) => Promise<ToolOutcome>;
}

// --- Yardımcılar -----------------------------------------------------------

const today = () => new Date().toISOString().slice(0, 10);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalı.");

/** Geçmişe/çok ileriye yazmayı engeller — model tarih uydurursa zarar vermesin. */
function withinWindow(date: string, backDays = 7, forwardDays = 60): boolean {
  const d = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(d)) return false;
  const now = Date.parse(`${today()}T00:00:00Z`);
  return d >= now - backDays * 86_400_000 && d <= now + forwardDays * 86_400_000;
}

const num = (v: unknown, f = 0) => (Number.isFinite(Number(v)) ? Number(v) : f);
const trLocale = (v: number) => Math.round(v).toLocaleString("tr-TR");

// ============================================================================
// OKUMA ARAÇLARI
// ============================================================================

const workoutHistoryTool: AgentTool = {
  name: "get_workout_history",
  description:
    "Kullanıcının antrenman geçmişini getirir: tarih, başlık, durum, süre, hacim ve çalışılan kas grupları. " +
    "Belirli bir dönemi ya da bir hareketin geçmişini incelemek için kullan. " +
    "Anlık görüntüde son 10 antrenman zaten var; bunu DAHA ESKİ ya da DAHA DETAYLI veri gerektiğinde çağır.",
  risk: "read",
  schema: z.object({
    days: z.number().int().min(1).max(365).default(30),
    exercise_name: z.string().max(80).optional(),
  }),
  parameters: {
    type: "object",
    properties: {
      days: { type: "integer", minimum: 1, maximum: 365, description: "Kaç günlük geçmiş (varsayılan 30)." },
      exercise_name: { type: "string", description: "Sadece bu hareketi içeren antrenmanlar." },
    },
    required: [],
  },
  async run(ctx, args) {
    const supabase = await createClient();
    const since = new Date(Date.now() - args.days * 86_400_000).toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("workouts")
      .select("id, title, workout_date, status, duration_min, workout_sets(reps, weight_kg, exercises(name, muscle_group))")
      .eq("user_id", ctx.userId)
      .gte("workout_date", since)
      .order("workout_date", { ascending: false })
      .limit(120);

    if (error) return { ok: false, content: `Antrenman geçmişi okunamadı: ${error.message}` };

    type SetRow = { reps: number | null; weight_kg: number | null; exercises: { name: string; muscle_group: string } | { name: string; muscle_group: string }[] | null };
    type Row = { id: string; title: string; workout_date: string; status: string; duration_min: number | null; workout_sets: SetRow[] | null };

    let rows = (data ?? []) as Row[];
    if (args.exercise_name) {
      const needle = args.exercise_name.toLocaleLowerCase("tr");
      rows = rows.filter((w) =>
        (w.workout_sets ?? []).some((s) => {
          const ex = Array.isArray(s.exercises) ? s.exercises[0] : s.exercises;
          return ex?.name?.toLocaleLowerCase("tr").includes(needle);
        })
      );
    }

    if (rows.length === 0) {
      return {
        ok: true,
        content: `Son ${args.days} günde${args.exercise_name ? ` "${args.exercise_name}" içeren` : ""} antrenman kaydı YOK.`,
        result: { count: 0 },
      };
    }

    const muscleTotals = new Map<string, number>();
    const lines = rows.slice(0, 30).map((w) => {
      let volume = 0;
      for (const s of w.workout_sets ?? []) {
        const v = num(s.weight_kg) * num(s.reps);
        volume += v;
        const ex = Array.isArray(s.exercises) ? s.exercises[0] : s.exercises;
        if (ex?.muscle_group) muscleTotals.set(ex.muscle_group, (muscleTotals.get(ex.muscle_group) ?? 0) + v);
      }
      return `${w.workout_date} · ${w.title} · ${w.status === "completed" ? "tamamlandı" : w.status} · ${
        w.duration_min ? `${w.duration_min} dk · ` : ""
      }${trLocale(volume)} kg hacim`;
    });

    const completed = rows.filter((w) => w.status === "completed").length;
    const muscles = [...muscleTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([m, v]) => `${m}: ${trLocale(v)} kg`);

    return {
      ok: true,
      content:
        `Son ${args.days} gün: ${rows.length} kayıt, ${completed} tamamlandı.\n` +
        lines.join("\n") +
        (muscles.length ? `\nKas grubu hacim dağılımı — ${muscles.join(", ")}` : ""),
      result: { count: rows.length, completed },
    };
  },
};

const nutritionTool: AgentTool = {
  name: "get_nutrition_status",
  description:
    "Beslenme kayıtlarını getirir: günlük kalori/protein/karbonhidrat/yağ toplamları, hedefe uzaklık ve öğün dağılımı. " +
    "Kullanıcı beslenmesini sorduğunda ya da makro önerisi vermeden ÖNCE çağır.",
  risk: "read",
  schema: z.object({ days: z.number().int().min(1).max(90).default(7) }),
  parameters: {
    type: "object",
    properties: { days: { type: "integer", minimum: 1, maximum: 90, description: "Kaç günlük kayıt (varsayılan 7)." } },
    required: [],
  },
  async run(ctx, args) {
    const supabase = await createClient();
    const since = new Date(Date.now() - args.days * 86_400_000).toISOString().slice(0, 10);

    const [{ data: logs, error }, { data: profile }] = await Promise.all([
      supabase
        .from("nutrition_logs")
        .select("log_date, meal, food_name, calories, protein_g, carbs_g, fat_g")
        .eq("user_id", ctx.userId)
        .gte("log_date", since)
        .order("log_date", { ascending: false }),
      supabase
        .from("profiles")
        .select("daily_calorie_goal, daily_protein_goal, daily_carb_goal, daily_fat_goal")
        .eq("id", ctx.userId)
        .maybeSingle(),
    ]);

    if (error) return { ok: false, content: `Beslenme kaydı okunamadı: ${error.message}` };

    type Log = { log_date: string; meal: string; food_name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number };
    const rows = (logs ?? []) as Log[];
    if (rows.length === 0) {
      return {
        ok: true,
        content: `Son ${args.days} günde beslenme kaydı YOK. Kullanıcı yemek girmemiş — kalori/protein hakkında rakam verme, önce kayıt girmesini iste.`,
        result: { days: 0 },
      };
    }

    const byDay = new Map<string, { cal: number; pro: number; carb: number; fat: number }>();
    for (const r of rows) {
      const d = byDay.get(r.log_date) ?? { cal: 0, pro: 0, carb: 0, fat: 0 };
      d.cal += num(r.calories); d.pro += num(r.protein_g);
      d.carb += num(r.carbs_g); d.fat += num(r.fat_g);
      byDay.set(r.log_date, d);
    }

    const p = (profile ?? {}) as Record<string, unknown>;
    const calGoal = num(p.daily_calorie_goal, 0);
    const proGoal = num(p.daily_protein_goal, 0);

    const daily = [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 14)
      .map(([d, v]) =>
        `${d}: ${Math.round(v.cal)} kcal${calGoal ? ` (hedef ${calGoal})` : ""}, ` +
        `protein ${Math.round(v.pro)} g${proGoal ? ` (hedef ${proGoal}, ${proGoal - v.pro > 0 ? `${Math.round(proGoal - v.pro)} g eksik` : "hedef tuttu"})` : ""}, ` +
        `karbonhidrat ${Math.round(v.carb)} g, yağ ${Math.round(v.fat)} g`
      );

    const n = byDay.size;
    const totals = [...byDay.values()].reduce(
      (a, v) => ({ cal: a.cal + v.cal, pro: a.pro + v.pro, carb: a.carb + v.carb, fat: a.fat + v.fat }),
      { cal: 0, pro: 0, carb: 0, fat: 0 }
    );

    return {
      ok: true,
      content:
        `Son ${args.days} günde ${n} gün kayıt girilmiş (kayıtsız günler ortalamaya DAHİL DEĞİL).\n` +
        `Kayıt girilen günlerin ortalaması: ${Math.round(totals.cal / n)} kcal, ${Math.round(totals.pro / n)} g protein, ` +
        `${Math.round(totals.carb / n)} g karbonhidrat, ${Math.round(totals.fat / n)} g yağ.\n` +
        daily.join("\n"),
      result: { logged_days: n, avg_calories: Math.round(totals.cal / n), avg_protein: Math.round(totals.pro / n) },
    };
  },
};

const gamificationTool: AgentTool = {
  name: "get_gamification",
  description:
    "XP, seviye, seri, coin, fitness skoru, Battle Pass kademesi ve haftalık görev ilerlemesini getirir. " +
    "Kullanıcı seviyesini/serisini/ödülünü sorduğunda ya da motive etmek için somut sayı gerektiğinde çağır.",
  risk: "read",
  schema: z.object({}),
  parameters: { type: "object", properties: {}, required: [] },
  async run(ctx) {
    const supabase = await createClient();
    const [{ data: gam }, { data: season }, { data: challenges }] = await Promise.all([
      supabase
        .from("user_gamification")
        .select("total_xp, level, current_streak, longest_streak, fitness_score, coins, season_xp")
        .eq("user_id", ctx.userId)
        .maybeSingle(),
      supabase.rpc("season_state", { p_user: ctx.userId }),
      supabase
        .from("weekly_challenges")
        .select("title, metric, target, challenge_progress(progress, completed)")
        .eq("active", true),
    ]);

    if (!gam) {
      return { ok: true, content: "Oyunlaştırma kaydı YOK — kullanıcı henüz XP kazanmamış.", result: {} };
    }

    const g = gam as Record<string, unknown>;
    const se = (season ?? {}) as Record<string, unknown>;
    type Ch = { title: string; target: number; challenge_progress: { progress: number; completed: boolean }[] | null };

    const chLines = ((challenges ?? []) as Ch[]).map((c) => {
      const pr = (c.challenge_progress ?? [])[0];
      return `- ${c.title}: ${num(pr?.progress)}/${c.target}${pr?.completed ? " ✓" : ""}`;
    });

    return {
      ok: true,
      content:
        `Seviye ${num(g.level)} · ${num(g.total_xp)} XP · seri ${num(g.current_streak)} gün ` +
        `(rekor ${num(g.longest_streak)}) · fitness skoru ${num(g.fitness_score)} · ${num(g.coins)} coin.` +
        (se.active
          ? `\nBattle Pass: kademe ${num(se.tier)}/${num(se.max_tier)}, sezon XP ${num(se.season_xp)}, sonraki kademeye ${num(se.next_req_xp)} XP.`
          : "\nAktif Battle Pass sezonu YOK.") +
        (chLines.length ? `\nHaftalık görevler:\n${chLines.join("\n")}` : ""),
      result: { level: num(g.level), xp: num(g.total_xp), streak: num(g.current_streak) },
    };
  },
};

const teamsTool: AgentTool = {
  name: "get_team_and_friends",
  description:
    "Takım bilgisi, takım arkadaşlarının XP sıralaması, aktif takım savaşları ve arkadaş listesini getirir. " +
    "'Takımda kim önde', 'arkadaşım beni geçti mi' gibi sorularda VE sosyal motivasyon kurmadan önce çağır.",
  risk: "read",
  schema: z.object({}),
  parameters: { type: "object", properties: {}, required: [] },
  async run(ctx) {
    const supabase = await createClient();

    const { data: membership } = await supabase
      .from("team_members")
      .select("role, teams(id, name, level)")
      .eq("user_id", ctx.userId)
      .maybeSingle();

    const parts: string[] = [];
    const team = membership
      ? (Array.isArray((membership as Record<string, unknown>).teams)
          ? ((membership as Record<string, unknown>).teams as Record<string, unknown>[])[0]
          : ((membership as Record<string, unknown>).teams as Record<string, unknown>))
      : null;

    if (team?.id) {
      const [{ data: members }, { data: battles }] = await Promise.all([
        supabase
          .from("team_members")
          .select("user_id, profiles(full_name), user_gamification(total_xp, level, current_streak)")
          .eq("team_id", team.id as string)
          .limit(50),
        supabase
          .from("team_battles")
          .select("id, metric, status, ends_on")
          .or(`team_a.eq.${team.id},team_b.eq.${team.id}`)
          .eq("status", "active"),
      ]);

      type M = { user_id: string; profiles: { full_name: string } | { full_name: string }[] | null; user_gamification: { total_xp: number; level: number; current_streak: number } | { total_xp: number; level: number; current_streak: number }[] | null };
      const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

      const ranked = ((members ?? []) as M[])
        .map((m) => ({
          id: m.user_id,
          name: one(m.profiles)?.full_name ?? "Üye",
          xp: num(one(m.user_gamification)?.total_xp),
          streak: num(one(m.user_gamification)?.current_streak),
        }))
        .sort((a, b) => b.xp - a.xp);

      const myIndex = ranked.findIndex((r) => r.id === ctx.userId);
      parts.push(
        `Takım: ${team.name} (seviye ${num(team.level)}, ${ranked.length} üye). ` +
          (myIndex >= 0 ? `Kullanıcı ${myIndex + 1}. sırada (${ranked[myIndex].xp} XP).` : "")
      );
      if (myIndex > 0) {
        const above = ranked[myIndex - 1];
        parts.push(`Hemen üstünde: ${above.name}, ${above.xp} XP — aradaki fark ${above.xp - ranked[myIndex].xp} XP.`);
      }
      parts.push(
        "Takım sıralaması: " +
          ranked.slice(0, 8).map((r, i) => `${i + 1}. ${r.name} ${r.xp} XP`).join(" · ")
      );
      if ((battles ?? []).length) {
        parts.push(
          `Aktif takım savaşı: ${(battles as Record<string, unknown>[]).map((b) => `${b.metric} (bitiş ${b.ends_on})`).join(", ")}`
        );
      }
    } else {
      parts.push("Kullanıcı hiçbir takıma üye DEĞİL.");
    }

    const { data: friends } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id, status")
      .eq("status", "accepted")
      .or(`requester_id.eq.${ctx.userId},addressee_id.eq.${ctx.userId}`)
      .limit(100);

    const friendIds = ((friends ?? []) as { requester_id: string; addressee_id: string }[]).map((f) =>
      f.requester_id === ctx.userId ? f.addressee_id : f.requester_id
    );

    if (friendIds.length) {
      const { data: fg } = await supabase
        .from("user_gamification")
        .select("user_id, total_xp, current_streak, profiles(full_name)")
        .in("user_id", friendIds)
        .order("total_xp", { ascending: false })
        .limit(10);

      type FG = { user_id: string; total_xp: number; current_streak: number; profiles: { full_name: string } | { full_name: string }[] | null };
      const list = ((fg ?? []) as FG[]).map((f) => {
        const pr = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles;
        return `${pr?.full_name ?? "Arkadaş"} ${num(f.total_xp)} XP (seri ${num(f.current_streak)})`;
      });
      parts.push(`${friendIds.length} arkadaşı var. En yüksek XP'liler: ${list.join(" · ")}`);
    } else {
      parts.push("Kullanıcının arkadaşı YOK.");
    }

    return { ok: true, content: parts.join("\n") };
  },
};

const goalProgressTool: AgentTool = {
  name: "get_goal_progress",
  description:
    "Kullanıcının aktif hedeflerini ve otomatik hesaplanmış ilerlemesini getirir; hedeften SAPMA olup olmadığını söyler. " +
    "Hedef hakkında konuşmadan önce mutlaka çağır — ilerlemeyi kendi kafandan hesaplama.",
  risk: "read",
  schema: z.object({}),
  parameters: { type: "object", properties: {}, required: [] },
  async run(ctx) {
    const supabase = await createClient();
    // Önce değerlendir (ulaşılan hedefi kapat), sonra oku.
    await supabase.rpc("evaluate_ai_goals", { p_user: ctx.userId });
    const { data, error } = await supabase.rpc("goal_progress", { p_user: ctx.userId });
    if (error) return { ok: false, content: `Hedefler okunamadı: ${error.message}` };

    type G = { title: string; metric: string; current_value: number | null; target_value: number; progress_pct: number | null; time_pct: number | null; on_track: boolean; days_left: number | null };
    const rows = (data ?? []) as G[];
    if (rows.length === 0) {
      return { ok: true, content: "Kullanıcının aktif hedefi YOK. İstersen `set_goal` ile bir hedef tanımlayabilirsin.", result: { count: 0 } };
    }

    return {
      ok: true,
      content: rows
        .map(
          (g) =>
            `${g.title} (${g.metric}): şu an ${g.current_value ?? "?"} → hedef ${g.target_value}. ` +
            `İlerleme ${g.progress_pct === null ? "hesaplanamıyor" : `%${g.progress_pct}`}, ` +
            `${g.time_pct === null ? "süre belirsiz" : `sürenin %${g.time_pct}'i geçti`}` +
            `${g.days_left === null ? "" : `, ${g.days_left} gün kaldı`}. ` +
            `${g.on_track ? "Yolunda." : "SAPMA VAR — kullanıcıyı uyar ve somut bir düzeltme öner."}`
        )
        .join("\n"),
      result: { count: rows.length, off_track: rows.filter((g) => !g.on_track).length },
    };
  },
};

const suggestExercisesTool: AgentTool = {
  name: "suggest_exercises",
  description:
    "Egzersiz kütüphanesinden kullanıcının ekipmanına ve sakatlığına uygun hareket önerir. " +
    "Antrenman önermeden önce çağır — kütüphanede olmayan hareket adı UYDURMA.",
  risk: "read",
  schema: z.object({
    muscle_group: z.string().max(40).optional(),
    limit: z.number().int().min(1).max(15).default(8),
  }),
  parameters: {
    type: "object",
    properties: {
      muscle_group: { type: "string", description: "Kas grubu (örn. göğüs, sırt, bacak). Boş bırakılırsa karma." },
      limit: { type: "integer", minimum: 1, maximum: 15 },
    },
    required: [],
  },
  async run(ctx, args) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("available_equipment, injuries, experience")
      .eq("id", ctx.userId)
      .maybeSingle();

    let q = supabase.from("exercises").select("name, muscle_group, equipment, difficulty").limit(args.limit * 3);
    if (args.muscle_group) q = q.ilike("muscle_group", `%${args.muscle_group}%`);

    const { data, error } = await q;
    if (error) return { ok: false, content: `Egzersiz kütüphanesi okunamadı: ${error.message}` };

    type Ex = { name: string; muscle_group: string; equipment: string | null; difficulty: string | null };
    const rows = (data ?? []) as Ex[];
    if (rows.length === 0) {
      return { ok: true, content: `"${args.muscle_group ?? "-"}" için kütüphanede hareket bulunamadı.`, result: { count: 0 } };
    }

    const p = (profile ?? {}) as Record<string, unknown>;
    const equipment = Array.isArray(p.available_equipment) ? (p.available_equipment as string[]) : [];
    const injuries = Array.isArray(p.injuries) ? (p.injuries as string[]) : [];

    const picked = rows.slice(0, args.limit);
    return {
      ok: true,
      content:
        `Kütüphaneden uygun hareketler:\n` +
        picked.map((e) => `- ${e.name} (${e.muscle_group}${e.equipment ? `, ${e.equipment}` : ""}${e.difficulty ? `, ${e.difficulty}` : ""})`).join("\n") +
        (equipment.length ? `\nKullanıcının ekipmanı: ${equipment.join(", ")} — buna uymayanları önerme.` : "") +
        (injuries.length ? `\nSAKATLIK: ${injuries.join(", ")} — bu bölgeyi zorlayan hareketleri ELE ve alternatif ver.` : ""),
      result: { count: picked.length },
    };
  },
};

// ============================================================================
// YAZMA ARAÇLARI (düşük risk — doğrudan çalışır)
// ============================================================================

const rememberTool: AgentTool = {
  name: "remember_fact",
  description:
    "Kullanıcı hakkında kalıcı olarak hatırlanması gereken bir bilgiyi kaydeder. " +
    "Kullanıcı sakatlığını, tercihini, programını ya da sevmediği hareketi söylediğinde çağır. " +
    "Anahtar kanonik olmalı (örn. 'injury.knee', 'preference.dislikes_exercise', 'schedule.trains_evening') " +
    "ki aynı bilgi tekrar gelince ÜZERİNE yazılsın, kopyalanmasın.",
  risk: "write",
  schema: z.object({
    key: z.string().min(2).max(80),
    value: z.string().min(1).max(500),
    category: z.enum(["profile", "goal", "preference", "injury", "schedule", "nutrition", "social", "other"]).default("other"),
    expires_in_days: z.number().int().min(1).max(365).optional(),
  }),
  parameters: {
    type: "object",
    properties: {
      key: { type: "string", description: "Kanonik anahtar, nokta ile ayrılmış: 'injury.knee', 'preference.dislikes_exercise'." },
      value: { type: "string", description: "Hatırlanacak bilginin kendisi, tam cümle." },
      category: { type: "string", enum: ["profile", "goal", "preference", "injury", "schedule", "nutrition", "social", "other"] },
      expires_in_days: { type: "integer", minimum: 1, maximum: 365, description: "Geçici bilgiyse kaç gün sonra unutulsun (örn. 'bu hafta tatildeyim' → 7)." },
    },
    required: ["key", "value"],
  },
  async run(ctx, args) {
    const id = await rememberFact(ctx.userId, {
      key: args.key,
      value: args.value,
      category: args.category,
      source: "conversation",
      confidence: 0.85,
      expiresInDays: args.expires_in_days,
    });
    if (!id) return { ok: false, content: "Bilgi kaydedilemedi." };
    return {
      ok: true,
      content: `Kaydedildi: "${args.value}" (${canonicalKey(args.key)}). Bundan sonraki konuşmalarda bu bilgi elinde olacak.`,
      result: { id, key: canonicalKey(args.key) },
      summary: `Hatırlandı: ${args.value}`,
    };
  },
};

const forgetTool: AgentTool = {
  name: "forget_fact",
  description:
    "Artık geçerli olmayan bir bilgiyi hafızadan siler. Kullanıcı 'sakatlığım geçti', 'artık onu seviyorum' " +
    "gibi bir düzeltme yaptığında çağır.",
  risk: "write",
  schema: z.object({ key: z.string().min(2).max(80) }),
  parameters: {
    type: "object",
    properties: { key: { type: "string", description: "Silinecek bilginin kanonik anahtarı." } },
    required: ["key"],
  },
  async run(ctx, args) {
    const ok = await forgetFact(ctx.userId, args.key);
    return {
      ok,
      content: ok ? `"${canonicalKey(args.key)}" hafızadan silindi.` : "Silinemedi.",
      result: { key: canonicalKey(args.key) },
      summary: ok ? `Unutuldu: ${canonicalKey(args.key)}` : undefined,
    };
  },
};

const setGoalTool: AgentTool = {
  name: "set_goal",
  description:
    "Kullanıcı için takip edilebilir bir hedef tanımlar. Hedef tanımlandıktan sonra ilerleme HER GÜN otomatik " +
    "hesaplanır ve sapma olursa uyarı üretilir. Kullanıcı '5 kilo vermek istiyorum' gibi bir şey söylediğinde çağır. " +
    "start_value'yu boş bırakma — mevcut değeri anlık görüntüden al ki ilerleme hesaplanabilsin.",
  risk: "write",
  schema: z.object({
    title: z.string().min(3).max(120),
    metric: z.enum([
      "weight", "body_fat", "workouts_per_week", "protein_daily",
      "steps_daily", "water_daily", "volume_weekly", "streak",
    ]),
    start_value: z.number().optional(),
    target_value: z.number(),
    target_date: isoDate.optional(),
  }),
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Hedefin kullanıcıya görünen adı, örn. '5 kilo vermek'." },
      metric: {
        type: "string",
        enum: ["weight", "body_fat", "workouts_per_week", "protein_daily", "steps_daily", "water_daily", "volume_weekly", "streak"],
        description: "Takip edilecek ölçüt.",
      },
      start_value: { type: "number", description: "Bugünkü değer. Bilinmiyorsa çağırmadan önce veriyi oku." },
      target_value: { type: "number", description: "Ulaşılmak istenen değer." },
      target_date: { type: "string", description: "Hedef tarihi (YYYY-AA-GG). Sapma uyarısı için gerekli." },
    },
    required: ["title", "metric", "target_value"],
  },
  async run(ctx, args) {
    const supabase = await createClient();

    // Başlangıç değeri verilmediyse metriğin gerçek güncel değerini oku —
    // model tahmin ederse ilerleme yüzdesi baştan yanlış çıkar.
    let start = args.start_value;
    if (start === undefined) {
      const { data } = await supabase.rpc("goal_current_value", { p_user: ctx.userId, p_metric: args.metric });
      const v = Number(data);
      if (Number.isFinite(v)) start = v;
    }
    if (start === undefined || !Number.isFinite(start)) {
      return {
        ok: false,
        content: `"${args.metric}" için başlangıç değeri bulunamadı. Kullanıcıdan mevcut değerini iste, sonra tekrar dene. İlerleme başlangıç değeri olmadan hesaplanamaz.`,
      };
    }

    const direction =
      args.target_value < start ? "decrease" : args.target_value > start ? "increase" : "maintain";

    const { data, error } = await supabase
      .from("ai_goals")
      .insert({
        user_id: ctx.userId,
        title: args.title,
        metric: args.metric,
        start_value: start,
        target_value: args.target_value,
        direction,
        target_date: args.target_date ?? null,
        created_by: "agent",
      })
      .select("id")
      .single();

    if (error) return { ok: false, content: `Hedef kaydedilemedi: ${error.message}` };

    return {
      ok: true,
      content:
        `Hedef kaydedildi: "${args.title}" — ${start} → ${args.target_value}` +
        `${args.target_date ? `, hedef tarihi ${args.target_date}` : " (tarih verilmedi; sapma uyarısı üretilemez, kullanıcıya tarih sormayı düşün)"}. ` +
        `İlerleme bundan sonra her gün otomatik hesaplanacak.`,
      result: { id: (data as { id: string }).id, start, direction },
      summary: `Hedef: ${args.title} (${start} → ${args.target_value})`,
    };
  },
};

const logWaterTool: AgentTool = {
  name: "log_water",
  description: "Kullanıcının içtiği suyu kaydeder. Kullanıcı 'yarım litre su içtim' dediğinde çağır.",
  risk: "write",
  schema: z.object({ amount_ml: z.number().int().min(50).max(3000) }),
  parameters: {
    type: "object",
    properties: { amount_ml: { type: "integer", minimum: 50, maximum: 3000, description: "Mililitre." } },
    required: ["amount_ml"],
  },
  async run(ctx, args) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("water_logs")
      .insert({ user_id: ctx.userId, amount_ml: args.amount_ml, log_date: today() });
    if (error) return { ok: false, content: `Su kaydedilemedi: ${error.message}` };

    const { data: rows } = await supabase
      .from("water_logs")
      .select("amount_ml")
      .eq("user_id", ctx.userId)
      .eq("log_date", today());
    const total = ((rows ?? []) as { amount_ml: number }[]).reduce((a, r) => a + num(r.amount_ml), 0);

    return {
      ok: true,
      content: `${args.amount_ml} ml su kaydedildi. Bugünkü toplam: ${total} ml.`,
      result: { added: args.amount_ml, total_today: total },
      summary: `${args.amount_ml} ml su kaydedildi`,
    };
  },
};

const scheduleWorkoutTool: AgentTool = {
  name: "schedule_workout",
  description:
    "Belirli bir güne antrenman planlar. Kullanıcı 'yarın göğüs çalışayım' dediğinde ya da haftalık plan " +
    "kurarken çağır. Sadece planlar — antrenmanı kullanıcı uygulamada başlatır.",
  risk: "write",
  schema: z.object({
    date: isoDate,
    title: z.string().min(2).max(80),
    note: z.string().max(500).optional(),
  }),
  parameters: {
    type: "object",
    properties: {
      date: { type: "string", description: "YYYY-AA-GG. Bugün ya da gelecek bir gün olmalı." },
      title: { type: "string", description: "Antrenman başlığı, örn. 'Göğüs + triceps'." },
      note: { type: "string", description: "Kısa açıklama / hareket listesi." },
    },
    required: ["date", "title"],
  },
  async run(ctx, args) {
    if (!withinWindow(args.date, 0, 60)) {
      return { ok: false, content: `${args.date} geçerli bir plan tarihi değil (bugün ile 60 gün sonrası arası olmalı).` };
    }
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("workouts")
      .select("id, title, status")
      .eq("user_id", ctx.userId)
      .eq("workout_date", args.date)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const e = existing as { title: string; status: string };
      return {
        ok: false,
        content: `${args.date} tarihinde zaten bir antrenman var: "${e.title}" (${e.status}). Üzerine yazmadım — kullanıcıya sor.`,
        result: { conflict: true },
      };
    }

    const { data, error } = await supabase
      .from("workouts")
      .insert({ user_id: ctx.userId, workout_date: args.date, title: args.title, notes: args.note ?? null, status: "planned" })
      .select("id")
      .single();

    if (error) return { ok: false, content: `Antrenman planlanamadı: ${error.message}` };
    return {
      ok: true,
      content: `${args.date} tarihine "${args.title}" planlandı.`,
      result: { id: (data as { id: string }).id, date: args.date },
      summary: `${args.date}: ${args.title} planlandı`,
    };
  },
};

const restDayTool: AgentTool = {
  name: "add_rest_day",
  description:
    "Bir günü dinlenme günü yapar: o güne planlanmış (henüz başlanmamış) antrenmanı kaldırır ve dinlenme notu bırakır. " +
    "Toparlanma skoru düşükse ya da kullanıcı yorgunsa çağır. Tamamlanmış antrenmana DOKUNMAZ.",
  risk: "write",
  schema: z.object({ date: isoDate, reason: z.string().max(200).optional() }),
  parameters: {
    type: "object",
    properties: {
      date: { type: "string", description: "YYYY-AA-GG." },
      reason: { type: "string", description: "Neden dinlenme günü — kullanıcı geri dönüp görebilsin." },
    },
    required: ["date"],
  },
  async run(ctx, args) {
    if (!withinWindow(args.date, 0, 60)) {
      return { ok: false, content: `${args.date} geçerli bir tarih değil (bugün ile 60 gün sonrası arası).` };
    }
    const supabase = await createClient();

    // Tamamlanmış antrenman SİLİNMEZ — geçmiş veri agent tarafından bozulamaz.
    const { data: removed, error } = await supabase
      .from("workouts")
      .delete()
      .eq("user_id", ctx.userId)
      .eq("workout_date", args.date)
      .eq("status", "planned")
      .select("id, title");

    if (error) return { ok: false, content: `Dinlenme günü ayarlanamadı: ${error.message}` };

    const gone = (removed ?? []) as { title: string }[];
    await supabase.from("daily_metrics").upsert(
      {
        user_id: ctx.userId,
        metric_date: args.date,
        note: `Dinlenme günü — koç önerisi${args.reason ? `: ${args.reason}` : ""}`,
        source: "manual",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,metric_date" }
    );

    return {
      ok: true,
      content:
        gone.length
          ? `${args.date} dinlenme günü yapıldı; planlı "${gone.map((g) => g.title).join(", ")}" kaldırıldı.`
          : `${args.date} dinlenme günü olarak işaretlendi (o gün zaten planlı antrenman yoktu).`,
      result: { date: args.date, removed: gone.length },
      summary: `${args.date} dinlenme günü`,
    };
  },
};

// ============================================================================
// HASSAS ARAÇLAR (onay ister — çalıştırılmadan önce kullanıcıya sorulur)
// ============================================================================

const macroTool: AgentTool = {
  name: "update_macro_targets",
  description:
    "Günlük kalori ve makro hedeflerini değiştirir. Kullanıcının kilo hedefi, aktivite düzeyi ya da ilerlemesi " +
    "değiştiğinde öner. ÖNEMLİ: Bu değişiklik kullanıcı ONAYLAMADAN uygulanmaz; sen çağırdığında kullanıcıya " +
    "onay kartı gösterilir. Değerleri gerekçesiyle birlikte açıkla.",
  risk: "sensitive",
  schema: z.object({
    calories: z.number().int().min(1000).max(6000),
    protein_g: z.number().int().min(30).max(400),
    carbs_g: z.number().int().min(20).max(800).optional(),
    fat_g: z.number().int().min(15).max(250).optional(),
    reason: z.string().min(5).max(300),
  }),
  parameters: {
    type: "object",
    properties: {
      calories: { type: "integer", minimum: 1000, maximum: 6000 },
      protein_g: { type: "integer", minimum: 30, maximum: 400 },
      carbs_g: { type: "integer", minimum: 20, maximum: 800 },
      fat_g: { type: "integer", minimum: 15, maximum: 250 },
      reason: { type: "string", description: "Neden değiştiriyorsun — kullanıcı onay kartında bunu okuyacak." },
    },
    required: ["calories", "protein_g", "reason"],
  },
  proposal: (a) =>
    `Günlük hedefler: ${a.calories} kcal · ${a.protein_g} g protein` +
    `${a.carbs_g ? ` · ${a.carbs_g} g karbonhidrat` : ""}${a.fat_g ? ` · ${a.fat_g} g yağ` : ""}. Gerekçe: ${a.reason}`,
  async run(ctx, args) {
    const supabase = await createClient();
    const patch: Record<string, unknown> = {
      daily_calorie_goal: args.calories,
      daily_protein_goal: args.protein_g,
      updated_at: new Date().toISOString(),
    };
    if (args.carbs_g !== undefined) patch.daily_carb_goal = args.carbs_g;
    if (args.fat_g !== undefined) patch.daily_fat_goal = args.fat_g;

    const { error } = await supabase.from("profiles").update(patch).eq("id", ctx.userId);
    if (error) return { ok: false, content: `Hedefler güncellenemedi: ${error.message}` };

    return {
      ok: true,
      content: `Makro hedefleri güncellendi: ${args.calories} kcal, ${args.protein_g} g protein.`,
      result: { ...patch },
      summary: `Hedefler: ${args.calories} kcal · ${args.protein_g} g protein`,
    };
  },
};

const intensityTool: AgentTool = {
  name: "adjust_program_intensity",
  description:
    "Kullanıcının aktif programının yoğunluğunu düşürür ya da artırır (set sayılarını ölçekler). " +
    "Toparlanma skoru düşükse azalt, ilerleme durduysa artır. Kullanıcı ONAYLAMADAN uygulanmaz.",
  risk: "sensitive",
  schema: z.object({
    direction: z.enum(["decrease", "increase"]),
    /** Yüzde: 20 = %20 azalt/artır. */
    percent: z.number().int().min(5).max(40).default(20),
    reason: z.string().min(5).max(300),
  }),
  parameters: {
    type: "object",
    properties: {
      direction: { type: "string", enum: ["decrease", "increase"] },
      percent: { type: "integer", minimum: 5, maximum: 40, description: "Yüzde kaç değişsin (varsayılan 20)." },
      reason: { type: "string", description: "Gerekçe — onay kartında görünecek." },
    },
    required: ["direction", "reason"],
  },
  proposal: (a) =>
    `Aktif programın yoğunluğu %${a.percent} ${a.direction === "decrease" ? "azaltılsın" : "artırılsın"}. Gerekçe: ${a.reason}`,
  async run(ctx, args) {
    const supabase = await createClient();
    const { data: program } = await supabase
      .from("programs")
      .select("id, title, plan")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!program) {
      return { ok: false, content: "Kullanıcının kayıtlı bir programı YOK — yoğunluk değiştirilemez. Önce program oluşturulmalı." };
    }

    const factor = args.direction === "decrease" ? 1 - args.percent / 100 : 1 + args.percent / 100;
    const plan = (program as { plan: unknown }).plan as { weeks?: { days?: { exercises?: { sets?: number }[] }[] }[] };
    let touched = 0;

    for (const w of plan?.weeks ?? []) {
      for (const d of w.days ?? []) {
        for (const e of d.exercises ?? []) {
          if (typeof e.sets === "number" && e.sets > 0) {
            // En az 1 set kalsın; aşağı yuvarlama programı sıfırlamasın.
            const next = Math.max(1, Math.round(e.sets * factor));
            if (next !== e.sets) { e.sets = next; touched += 1; }
          }
        }
      }
    }

    if (touched === 0) {
      return { ok: false, content: "Programda ölçeklenebilir set bilgisi bulunamadı; yoğunluk değiştirilemedi." };
    }

    const { error } = await supabase.from("programs").update({ plan }).eq("id", (program as { id: string }).id);
    if (error) return { ok: false, content: `Program güncellenemedi: ${error.message}` };

    return {
      ok: true,
      content: `"${(program as { title: string }).title}" programında ${touched} egzersizin set sayısı %${args.percent} ${
        args.direction === "decrease" ? "azaltıldı" : "artırıldı"
      }.`,
      result: { program_id: (program as { id: string }).id, touched, factor },
      summary: `Program yoğunluğu %${args.percent} ${args.direction === "decrease" ? "azaltıldı" : "artırıldı"}`,
    };
  },
};

// ============================================================================
// KAYIT DEFTERİ
// ============================================================================

const ALL_TOOLS: AgentTool[] = [
  workoutHistoryTool, nutritionTool, gamificationTool, teamsTool,
  goalProgressTool, suggestExercisesTool,
  rememberTool, forgetTool, setGoalTool, logWaterTool,
  scheduleWorkoutTool, restDayTool,
  macroTool, intensityTool,
];

export const TOOL_REGISTRY: Record<string, AgentTool> = Object.fromEntries(
  ALL_TOOLS.map((t) => [t.name, t])
);

/** Modele sunulacak araç tanımları. Salt-okunur mod yalnızca `read` araçları verir. */
export function toolDefinitions(opts?: { readOnly?: boolean }): ToolDefinition[] {
  return ALL_TOOLS.filter((t) => (opts?.readOnly ? t.risk === "read" : true)).map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export function getTool(name: string): AgentTool | null {
  return TOOL_REGISTRY[name] ?? null;
}

/**
 * Model argümanlarını doğrular.
 *
 * Model şemayı ihlal eden argüman üretebilir (yanlış tip, eksik alan, uydurulmuş
 * enum). Bunu araç içinde yakalamak yerine tek noktada zod ile kesiyoruz;
 * hata mesajı modele geri gidiyor ve model kendini düzeltebiliyor.
 */
export function parseArgs(
  tool: AgentTool,
  raw: Record<string, unknown>
): { ok: true; args: unknown } | { ok: false; error: string } {
  const parsed = tool.schema.safeParse(raw ?? {});
  if (parsed.success) return { ok: true, args: parsed.data };
  const msg = parsed.error.issues
    .map((i) => `${i.path.join(".") || "(kök)"}: ${i.message}`)
    .join("; ");
  return { ok: false, error: msg };
}
