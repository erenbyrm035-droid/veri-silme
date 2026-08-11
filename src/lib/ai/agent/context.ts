import "server-only";
import { createClient } from "@/lib/supabase/server";
import { GOAL_LABELS, EXPERIENCE_LABELS, ENVIRONMENT_LABELS } from "@/lib/constants";
import type { GoalProgress, AgentFact } from "./types";

// ============================================================================
// Agent bağlamı — CEVAP ÜRETMEDEN ÖNCE ÇEKİLİR.
//
// `agent_snapshot(p_user)` RPC'si kullanıcının tüm durumunu TEK sorguda döner:
// profil, bugün (su/protein/kalori/adım/uyku/recovery/readiness), oyunlaştırma,
// sezon, takım, sosyal, haftalık görevler, aktif hedefler, kalıcı hafıza,
// son 10 antrenman, 12 aylık özet, 7 günlük beslenme ortalaması.
//
// NEDEN TEK RPC: Aynı bilgiyi TS'ten 15 ayrı sorguyla toplamak hem ~15 ağ
// gidiş-gelişi hem de her sorgunun ayrı ayrı hata verebileceği kırılgan bir
// yol demekti. Tek RPC = tek tur, tutarlı anlık görüntü.
//
// NEDEN 365 GÜN HAM DEĞİL: Bir yıllık ham antrenman kaydı prompt'a sığmaz
// (~100k+ token). RPC aylık toplamlar döndürüyor; sinyal korunur, maliyet
// kalkar. Agent detaya ihtiyaç duyarsa `get_workout_history` aracını çağırır.
// ============================================================================

/** `agent_snapshot()` çıktısı. Alanlar RPC'de yoksa undefined gelir. */
export interface AgentSnapshot {
  generated_at?: string;
  profile?: Record<string, unknown>;
  today?: Record<string, unknown>;
  gamification?: Record<string, unknown>;
  season?: Record<string, unknown>;
  team?: Record<string, unknown> | null;
  social?: Record<string, unknown>;
  challenges?: Record<string, unknown>[];
  goals?: GoalProgress[];
  facts?: AgentFact[];
  recent_workouts?: Record<string, unknown>[];
  monthly?: Record<string, unknown>[];
  nutrition_7d?: Record<string, unknown>;
}

/**
 * Anlık görüntüyü çeker.
 *
 * RPC hata verirse null döner — agent bağlamsız da çalışabilmeli, çünkü
 * bağlam eksikliği cevabı engellememeli; sadece agent "verine ulaşamadım"
 * demeli. Sessizce yanlış cevap üretmekten iyidir.
 *
 * AI ONAYI (`profiles.ai_consent = false`): RPC veriyi ayırt etmeden döndürür;
 * onay kontrolü BURADA yapılır ve anlık görüntü isim + hedefe indirgenir.
 * Kullanıcı verisinin AI'a gitmesini reddettiyse antrenman geçmişi, sağlık
 * bilgisi, beslenme kaydı ve hafıza modele HİÇ gönderilmez.
 */
export async function getAgentSnapshot(userId: string): Promise<AgentSnapshot | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("agent_snapshot", { p_user: userId });
    if (error || !data) return null;

    const snap = data as AgentSnapshot;
    const profile = obj(snap.profile);
    if (profile.ai_consent === false) {
      return {
        generated_at: snap.generated_at,
        profile: { full_name: profile.full_name, goal: profile.goal, ai_consent: false },
        today: {}, gamification: {}, season: {}, team: null, social: {},
        challenges: [], goals: [], facts: [], recent_workouts: [], monthly: [],
        nutrition_7d: {},
      };
    }
    return snap;
  } catch {
    return null;
  }
}

/** Kullanıcı verisinin AI'a gitmesine onay verdi mi? */
export function hasAiConsent(snap: AgentSnapshot | null): boolean {
  if (!snap) return true; // veri yoksa kısıtlayacak bir şey de yok
  return obj(snap.profile).ai_consent !== false;
}

// --- Yardımcılar -----------------------------------------------------------

const s = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
};
const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** "Etiket: değer" satırı — değer yoksa satır hiç üretilmez. */
function line(label: string, value: unknown, suffix = ""): string | null {
  const v = typeof value === "number" ? n(value) : s(value);
  if (v === null) return null;
  return `- ${label}: ${v}${suffix}`;
}

/** Bir dizi satırdan bölüm üretir; hiç satır yoksa bölüm de yok. */
function section(title: string, lines: (string | null)[]): string {
  const kept = lines.filter((l): l is string => !!l);
  return kept.length ? `${title}\n${kept.join("\n")}` : "";
}

const pct = (done: unknown, goal: unknown): string | null => {
  const d = n(done), g = n(goal);
  if (d === null || g === null || g <= 0) return null;
  return `%${Math.round((d / g) * 100)}`;
};

// --- Prompt üretimi --------------------------------------------------------

/**
 * Anlık görüntüyü modelin okuyacağı Türkçe bloğa çevirir.
 *
 * TASARIM: JSON'u ham göndermiyoruz. Model JSON'da eksik alanı "0" sanabilir
 * ya da anahtarları uydurabilir. Düz metinde olmayan bilgi HİÇ yazılmaz ve
 * blok sonunda "eksik veriler" açıkça listelenir — model neyi bilmediğini de
 * bilir, böylece tahmin yürütmek yerine soru sorar.
 */
export function snapshotToPrompt(snap: AgentSnapshot | null): string {
  if (!snap) {
    return (
      "\n\nKULLANICI VERİSİ: Şu an kullanıcının verisine ULAŞILAMIYOR. " +
      "Kişisel rakam verme, geçmişine atıfta bulunma. Genel bilgi ver ve " +
      "verilerine şu an ulaşamadığını dürüstçe söyle."
    );
  }

  const p = obj(snap.profile);
  if (p.ai_consent === false) {
    return (
      "\n\nKULLANICI VERİSİ: Kullanıcı kişisel verisinin AI'a aktarılmasına ONAY VERMEDİ. " +
      `${s(p.full_name) ? `İsmi: ${s(p.full_name)}. ` : ""}` +
      "Antrenman geçmişine, sağlık bilgisine, beslenme kaydına ve hafızasına ERİŞİMİN YOK. " +
      "Kişisel rakam verme, geçmişine atıfta bulunma, araç çağırma. Genel ve güvenli bilgi ver; " +
      "kişiselleştirme isterse Ayarlar'dan AI onayını açabileceğini söyle."
    );
  }

  const t = obj(snap.today);
  const g = obj(snap.gamification);
  const se = obj(snap.season);
  const team = snap.team ? obj(snap.team) : null;
  const soc = obj(snap.social);
  const nut = obj(snap.nutrition_7d);
  const missing: string[] = [];

  // --- Profil / sağlık ---
  const injuries = arr(p.injuries).map(String).filter(Boolean);
  const conditions = arr(p.health_conditions).map(String).filter(Boolean);
  const allergies = arr(p.allergies).map(String).filter(Boolean);
  const goalKey = s(p.goal);
  const expKey = s(p.experience);
  const envKey = s(p.training_environment);

  const profileBlock = section("PROFİL", [
    line("İsim", p.full_name),
    line("Yaş", p.age),
    line("Cinsiyet", p.gender),
    line("Boy", p.height_cm, " cm"),
    line("Kilo", p.weight_kg, " kg"),
    line("Hedef kilo", p.target_weight_kg, " kg"),
    line("Yağ oranı", p.body_fat_pct, "%"),
    goalKey ? `- Hedef: ${GOAL_LABELS[goalKey as keyof typeof GOAL_LABELS] ?? goalKey}` : null,
    expKey ? `- Deneyim: ${EXPERIENCE_LABELS[expKey as keyof typeof EXPERIENCE_LABELS] ?? expKey}` : null,
    envKey ? `- Antrenman ortamı: ${ENVIRONMENT_LABELS[envKey as keyof typeof ENVIRONMENT_LABELS] ?? envKey}` : null,
    line("Haftalık antrenman günü", p.weekly_training_days),
    injuries.length ? `- Sakatlıklar (ZORUNLU DİKKAT): ${injuries.join(", ")}` : null,
    conditions.length ? `- Sağlık durumu: ${conditions.join(", ")}` : null,
    allergies.length ? `- Alerjiler (beslenme önerisinde ZORUNLU DİKKAT): ${allergies.join(", ")}` : null,
    line("Sağlık notu", p.health_notes),
    `- Premium: ${p.is_premium ? `evet${s(p.membership_type) ? ` (${s(p.membership_type)})` : ""}` : "hayır"}`,
    line("Günlük kalori hedefi", p.daily_calorie_goal, " kcal"),
    line("Günlük protein hedefi", p.daily_protein_goal, " g"),
    line("Günlük su hedefi", p.daily_water_goal_ml, " ml"),
  ]);

  if (n(p.weight_kg) === null) missing.push("güncel kilo");
  if (n(p.height_cm) === null) missing.push("boy");
  if (n(p.body_fat_pct) === null) missing.push("vücut yağ oranı");

  // --- Bugün ---
  // `recovery_score`/`readiness_score` TABLO döndürdüğü için snapshot'ta bileşik
  // nesne olarak geliyor ({score, label, ...}). Skaler ihtimaline karşı ikisini
  // de destekliyoruz — RPC ileride sadeleşirse burası kırılmasın.
  const scoreOf = (v: unknown): number | null =>
    v && typeof v === "object" ? n(obj(v).score) : n(v);
  const labelOf = (v: unknown): string | null =>
    v && typeof v === "object" ? s(obj(v).label) : null;

  const recovery = scoreOf(t.recovery);
  const readiness = scoreOf(t.readiness);
  const sleepMin = n(t.sleep_minutes);
  const steps = n(t.steps);

  const todayBlock = section("BUGÜN", [
    line("Su", t.water_ml, ` ml${pct(t.water_ml, t.water_goal) ? ` (hedefin ${pct(t.water_ml, t.water_goal)}'i)` : ""}`),
    line("Kalori", t.calories, ` kcal${pct(t.calories, t.calorie_goal) ? ` (hedefin ${pct(t.calories, t.calorie_goal)}'i)` : ""}`),
    line("Protein", t.protein_g, ` g${pct(t.protein_g, t.protein_goal) ? ` (hedefin ${pct(t.protein_g, t.protein_goal)}'i)` : ""}`),
    steps ? `- Adım: ${steps}${pct(steps, t.step_goal) ? ` (hedefin ${pct(steps, t.step_goal)}'i)` : ""}` : null,
    sleepMin ? `- Uyku: ${Math.floor(sleepMin / 60)} saat ${sleepMin % 60} dakika` : null,
    t.workout_done
      ? `- Bugünkü antrenman: tamamlandı${s(t.workout_title) ? ` (${s(t.workout_title)})` : ""}`
      : t.workout_planned
        ? `- Bugünkü antrenman: planlı ama HENÜZ YAPILMADI${s(t.workout_title) ? ` (${s(t.workout_title)})` : ""}`
        : "- Bugün için planlanmış antrenman yok.",
    line("Günlük görev tamamlama", t.completion_pct, `% (${n(t.done_count) ?? 0}/${n(t.total_count) ?? 5})`),
    recovery !== null
      ? `- Toparlanma (recovery): ${recovery}/100${labelOf(t.recovery) ? ` — ${labelOf(t.recovery)}` : ""}`
      : null,
    readiness !== null
      ? `- Antrenmana hazır olma (readiness): ${readiness}/100${labelOf(t.readiness) ? ` — ${labelOf(t.readiness)}` : ""}`
      : null,
  ]);

  // 0 = "kayıt yok" ile "gerçekten 0" ayırt edilemez; ikisinde de rakam
  // uydurulmaması gerektiği için eksik listesine giriyor.
  if (!steps) missing.push("bugünkü adım sayısı (girilmemiş)");
  if (!sleepMin) missing.push("bugünkü uyku süresi (girilmemiş)");

  // --- İlerleme / oyunlaştırma ---
  const gamBlock = section("İLERLEME", [
    line("Seviye", g.level),
    line("Toplam XP", g.total_xp),
    line("Güncel seri", g.current_streak, " gün"),
    line("En uzun seri", g.longest_streak, " gün"),
    line("Fitness skoru", g.fitness_score),
    line("Coin", g.coins),
    se.active
      ? `- Battle Pass: kademe ${n(se.tier) ?? 0}/${n(se.max_tier) ?? 0}, sezon XP ${n(se.season_xp) ?? 0}${
          n(se.next_req_xp) !== null ? `, sonraki kademe için ${n(se.next_req_xp)} XP` : ""
        }`
      : null,
  ]);

  // --- Sosyal ---
  const socialBlock = section("SOSYAL", [
    team
      ? `- Takım: ${s(team.name) ?? "?"} (seviye ${n(team.level) ?? "?"}, ${n(team.member_count) ?? "?"} üye, rol: ${s(team.role) ?? "üye"})${
          n(team.active_battles) ? `, ${n(team.active_battles)} aktif takım savaşı var` : ""
        }`
      : "- Takım: yok",
    line("Arkadaş sayısı", soc.friends),
    line("Takipçi", soc.followers),
    n(soc.pending_requests) ? `- Bekleyen arkadaşlık isteği: ${n(soc.pending_requests)}` : null,
  ]);

  // --- Haftalık görevler ---
  const challenges = arr(snap.challenges).map(obj);
  const chBlock = challenges.length
    ? section(
        "HAFTALIK GÖREVLER",
        challenges.map(
          (c) =>
            `- ${s(c.title) ?? "?"}: ${n(c.progress) ?? 0}/${n(c.target) ?? 0}${c.completed ? " ✓ tamamlandı" : ""}`
        )
      )
    : "";

  // --- Hedefler ---
  const goals = (snap.goals ?? []) as GoalProgress[];
  const goalsBlock = goals.length
    ? section(
        "AKTİF HEDEFLER (ilerleme otomatik hesaplandı)",
        goals.map((gl) => {
          const prog = gl.progress_pct === null ? "hesaplanamıyor" : `%${gl.progress_pct}`;
          const time = gl.time_pct === null ? "süre belirsiz" : `sürenin %${gl.time_pct}'i geçti`;
          const status = gl.on_track ? "yolunda" : "SAPMA VAR — uyarman gerekiyor";
          const left = gl.days_left === null ? "" : `, ${gl.days_left} gün kaldı`;
          return `- ${gl.title}: ${gl.current_value ?? "?"} → hedef ${gl.target_value} · ilerleme ${prog}, ${time}${left} · ${status}`;
        })
      )
    : "";

  // --- Kalıcı hafıza ---
  const facts = (snap.facts ?? []) as AgentFact[];
  const factsBlock = facts.length
    ? section(
        "HATIRLADIKLARIN (kalıcı hafıza — kullanıcı bunları daha önce söyledi)",
        facts
          .slice(0, 40)
          .map((f) => `- [${f.category}] ${f.value}${f.confidence < 0.6 ? " (emin değilsin, gerekirse teyit et)" : ""}`)
      )
    : "";

  // --- Antrenman geçmişi ---
  const recent = arr(snap.recent_workouts).map(obj);
  const recentBlock = recent.length
    ? section(
        "SON ANTRENMANLAR",
        recent.map(
          (w) =>
            `- ${s(w.date) ?? "?"}: ${s(w.title) ?? "Antrenman"} (${w.status === "completed" ? "tamamlandı" : "planlandı"}${
              n(w.minutes) ? `, ${n(w.minutes)} dk` : ""
            }${n(w.volume) ? `, ${Math.round(n(w.volume)!).toLocaleString("tr-TR")} kg hacim` : ""})`
        )
      )
    : "- Kayıtlı antrenman yok.";

  // --- 12 aylık ---
  const monthly = arr(snap.monthly).map(obj);
  const monthlyBlock = monthly.length
    ? section(
        "SON 12 AYIN ÖZETİ (aylık toplam)",
        monthly.map(
          (m) => `- ${s(m.month)}: ${n(m.workouts) ?? 0} antrenman, ${n(m.minutes) ?? 0} dk, ${Math.round(n(m.volume) ?? 0).toLocaleString("tr-TR")} kg`
        )
      )
    : "";

  // --- Beslenme ---
  const nutBlock =
    n(nut.logged_days) && n(nut.logged_days)! > 0
      ? section("SON 7 GÜN BESLENME", [
          `- ${n(nut.logged_days)} gün kayıt girilmiş`,
          line("Ortalama kalori", nut.avg_calories, " kcal"),
          line("Ortalama protein", nut.avg_protein, " g"),
        ])
      : "- Son 7 günde beslenme kaydı yok.";

  const blocks = [
    profileBlock,
    todayBlock,
    gamBlock,
    socialBlock,
    chBlock,
    goalsBlock,
    factsBlock,
    recentBlock,
    monthlyBlock,
    nutBlock,
  ].filter(Boolean);

  const missingBlock = missing.length
    ? `\nELİNDE OLMAYAN VERİLER: ${missing.join(", ")}. Bunlara dair rakam UYDURMA; ` +
      `gerekiyorsa kullanıcıya sor ya da uygulamada nereye gireceğini söyle.`
    : "";

  return (
    "\n\n=== KULLANICI DURUMU (gerçek uygulama verisi, cevabını buna dayandır) ===\n" +
    blocks.join("\n\n") +
    missingBlock +
    "\n=== DURUM SONU ==="
  );
}

/** Tek adımda: anlık görüntüyü çek → prompt bloğuna çevir. */
export async function buildAgentContext(
  userId: string
): Promise<{ snapshot: AgentSnapshot | null; prompt: string }> {
  const snapshot = await getAgentSnapshot(userId);
  return { snapshot, prompt: snapshotToPrompt(snapshot) };
}
