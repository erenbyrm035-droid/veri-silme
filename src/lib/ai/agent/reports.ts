import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getAIProvider } from "@/lib/ai/provider";
import { stripMarkdown } from "@/lib/ai/strip-markdown";
import { getAgentSnapshot, snapshotToPrompt, type AgentSnapshot } from "./context";
import { buildNudges } from "./proactive";
import { selfCheckPrompt } from "./selfcheck";
import type { AgentReport, ReportKind } from "./types";

// ============================================================================
// GÜNLÜK / HAFTALIK / AYLIK RAPORLAR
//
// ÜRETİM STRATEJİSİ — "tembel + tek cron":
//
// Vercel Hobby planı GÜNDE TEK cron'a izin veriyor ve o slot zaten takım
// etkinlik hatırlatıcısında. Dolayısıyla "her sabah 08:00'de herkese rapor
// üret" gibi bir tasarım bu planda ÇALIŞMAZ.
//
// Çözüm: rapor kullanıcı uygulamayı açtığında üretilir (`ensureReport`).
//   - `unique(user_id, kind, report_date)` kısıtı sayesinde aynı gün ikinci
//     kez üretilmez; iki sekme aynı anda açılsa bile ikincisi çakışmadan döner.
//   - Kullanıcı o gün uygulamayı hiç açmazsa rapor üretilmez — ki zaten
//     kimsenin okumayacağı bir rapor için token harcamanın anlamı yok.
//   - Cron'a bağlanmak istenirse `generateReport` doğrudan çağrılabilir;
//     kod yolu aynı.
//
// MALİYET: Rapor kısa tutuluyor (max 320 token) ve günde en fazla dört tane
// üretilebiliyor (sabah/akşam/hafta/ay). Sayısal bulgular `metrics` alanına
// ham olarak yazılıyor — rapor metni yanlış olsa bile denetlenebilir kalıyor.
// ============================================================================

const KIND_WINDOW: Record<ReportKind, string> = {
  morning: "bugün için",
  evening: "bugünün sonu için",
  weekly: "son 7 gün için",
  monthly: "son 30 gün için",
};

const KIND_BRIEF: Record<ReportKind, string> = {
  morning:
    "GÜNAYDIN RAPORU yaz. Kullanıcı güne başlıyor. Bugün ne yapması gerektiğini söyle: " +
    "toparlanma skoruna göre antrenman şiddeti, günün hedefleri, dikkat etmesi gereken tek şey.",
  evening:
    "GÜN SONU RAPORU yaz. Bugün ne yaptığını özetle, tutturduğu ve kaçırdığı hedefleri söyle, " +
    "yarın için tek bir somut öneri ver. Kaçırdığı hedefte suçlayıcı olma.",
  weekly:
    "HAFTALIK RAPOR yaz. Son 7 günün eğilimini anlat: antrenman sayısı, hacim, beslenme tutarlılığı, " +
    "seri. Önceki haftayla kıyasla. Gelecek hafta için tek bir odak noktası belirle.",
  monthly:
    "AYLIK RAPOR yaz. Son 30 günü ve aylık özet tablosunu kullanarak büyük resmi anlat: " +
    "ilerleme yönü, hedeflere yakınlık, en güçlü ve en zayıf alan. Bir sonraki ay için somut bir hedef öner.",
};

/** O gün için rapor var mı? */
export async function getReport(userId: string, kind: ReportKind, date?: string): Promise<AgentReport | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_reports")
    .select("id, kind, report_date, headline, body, metrics, suggestions, seen_at, created_at")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("report_date", date ?? todayTR())
    .maybeSingle();
  return (data as AgentReport) ?? null;
}

/** Son raporlar (rapor sayfası / dashboard kartı). */
export async function getRecentReports(userId: string, limit = 10): Promise<AgentReport[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_reports")
    .select("id, kind, report_date, headline, body, metrics, suggestions, seen_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AgentReport[];
}

/** Raporu okundu işaretler. */
export async function markReportSeen(userId: string, reportId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("ai_reports")
    .update({ seen_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("user_id", userId)
    .is("seen_at", null);
}

/**
 * O gün için rapor yoksa üretir, varsa mevcut olanı döner.
 *
 * Sayfa render'ında çağrılmak üzere tasarlandı: hiçbir koşulda hata fırlatmaz,
 * üretilemezse null döner ve sayfa rapor kartı olmadan çizilir.
 */
export async function ensureReport(userId: string, kind: ReportKind): Promise<AgentReport | null> {
  try {
    const existing = await getReport(userId, kind);
    if (existing) return existing;

    // Hangi rapor türünün ne zaman anlamlı olduğu — sabah raporunu gece
    // yarısı, hafta raporunu haftanın ortasında üretmenin anlamı yok.
    if (!isDue(kind)) return null;

    return await generateReport(userId, kind);
  } catch {
    return null;
  }
}

/** Rapor türü şu an üretilmeli mi? */
export function isDue(kind: ReportKind, now = new Date()): boolean {
  const hour = Number(
    now.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Istanbul" })
  );
  const weekday = now.toLocaleDateString("en-US", { weekday: "short", timeZone: "Europe/Istanbul" });
  const dayOfMonth = Number(now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }).slice(8, 10));

  switch (kind) {
    case "morning": return hour >= 4 && hour < 14;
    case "evening": return hour >= 18;
    case "weekly":  return weekday === "Mon";   // hafta pazartesi özetlenir
    case "monthly": return dayOfMonth <= 3;     // ayın ilk günlerinde
    default: return false;
  }
}

/**
 * Raporu üretip kaydeder.
 *
 * `admin` istemcisi opsiyonel: cron'dan (oturumsuz) çağrıldığında gerekli.
 * Kullanıcı isteğinden çağrıldığında normal RLS istemcisi kullanılır.
 */
export async function generateReport(
  userId: string,
  kind: ReportKind,
  opts: { useAdmin?: boolean; snapshot?: AgentSnapshot | null } = {}
): Promise<AgentReport | null> {
  const snapshot = opts.snapshot !== undefined ? opts.snapshot : await getAgentSnapshot(userId);

  // Onay yoksa kişisel rapor üretilmez — kullanıcı verisinin AI'a gitmesini
  // reddetmiş demektir; rapor tanımı gereği o veriden yapılır.
  if (!snapshot || snapshot.profile?.ai_consent === false) return null;

  const nudges = buildNudges(snapshot);
  const metrics = extractMetrics(snapshot);
  const provider = getAIProvider();

  let headline: string;
  let body: string;

  if (provider) {
    const system =
      `Sen "Viva" adlı Türkçe fitness koçusun. ${KIND_BRIEF[kind]}\n` +
      `Rapor ${KIND_WINDOW[kind]}. En fazla 5 cümle. Samimi ve doğrudan konuş.\n` +
      `İLK SATIR: en fazla 60 karakterlik bir başlık (başına etiket koyma).\n` +
      `SONRAKİ SATIRLAR: rapor metni.\n` +
      `Markdown KULLANMA. Yıldız, diyez, başlık işareti yok.` +
      `${selfCheckPrompt()}` +
      `${snapshotToPrompt(snapshot)}` +
      (nudges.length
        ? `\n\nHESAPLANMIŞ BULGULAR:\n${nudges.map((n) => `- ${n.text}`).join("\n")}`
        : "");

    try {
      const text = await provider.complete(
        [
          { role: "system", content: system },
          { role: "user", content: `${kind} raporumu yaz.` },
        ],
        { temperature: 0.5, maxTokens: 320 }
      );
      const clean = stripMarkdown(text).trim();
      const [first, ...rest] = clean.split("\n").filter((l) => l.trim());
      headline = (first ?? "").slice(0, 120) || fallbackHeadline(kind);
      body = rest.join("\n").trim() || clean;
    } catch {
      ({ headline, body } = fallbackReport(kind, nudges));
    }
  } else {
    // Sağlayıcı yoksa rapor yine üretilir — sadece deterministik bulgulardan.
    ({ headline, body } = fallbackReport(kind, nudges));
  }

  if (!body) return null;

  const suggestions = nudges.slice(0, 3).map((n) => ({
    label: n.cta ?? "Aç",
    href: n.href,
    text: n.text,
  }));

  const supabase = opts.useAdmin ? createAdminClient() : await createClient();
  const { data, error } = await supabase
    .from("ai_reports")
    .upsert(
      {
        user_id: userId,
        kind,
        report_date: todayTR(),
        headline,
        body,
        metrics,
        suggestions,
      },
      { onConflict: "user_id,kind,report_date", ignoreDuplicates: true }
    )
    .select("id, kind, report_date, headline, body, metrics, suggestions, seen_at, created_at")
    .maybeSingle();

  if (error) return null;
  // `ignoreDuplicates` ile çakışmada satır dönmez — o durumda mevcut raporu oku.
  return (data as AgentReport) ?? (await getReport(userId, kind));
}

// --- Yardımcılar -----------------------------------------------------------

function todayTR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
}

const num = (v: unknown, f = 0) => (Number.isFinite(Number(v)) ? Number(v) : f);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Raporun dayandığı ham sayılar — denetlenebilirlik için saklanır. */
function extractMetrics(snap: AgentSnapshot): Record<string, unknown> {
  const t = obj(snap.today);
  const g = obj(snap.gamification);
  const n = obj(snap.nutrition_7d);
  const rec = obj(t.recovery);
  return {
    water_ml: num(t.water_ml), water_goal: num(t.water_goal),
    protein_g: num(t.protein_g), protein_goal: num(t.protein_goal),
    calories: num(t.calories), calorie_goal: num(t.calorie_goal),
    steps: num(t.steps), sleep_minutes: num(t.sleep_minutes),
    workout_done: t.workout_done === true,
    completion_pct: num(t.completion_pct),
    recovery: Number.isFinite(Number(rec.score)) ? Number(rec.score) : num(t.recovery, 0),
    level: num(g.level), total_xp: num(g.total_xp), streak: num(g.current_streak),
    nutrition_logged_days: num(n.logged_days),
    goals_off_track: (snap.goals ?? []).filter((x) => !x.on_track).length,
  };
}

function fallbackHeadline(kind: ReportKind): string {
  return { morning: "Günaydın", evening: "Günün özeti", weekly: "Haftalık özet", monthly: "Aylık özet" }[kind];
}

/**
 * AI olmadan da rapor üretir.
 *
 * Bulgular zaten deterministik olarak hesaplanmış durumda; model sadece onları
 * güzel cümleye çeviriyordu. Model yoksa bulguları düz biçimde sunmak,
 * "rapor üretilemedi" demekten iyidir.
 */
function fallbackReport(kind: ReportKind, nudges: ReturnType<typeof buildNudges>): { headline: string; body: string } {
  const lines = nudges.slice(0, 4).map((n) => `• ${n.text}`);
  return {
    headline: fallbackHeadline(kind),
    body: lines.length
      ? lines.join("\n")
      : "Bugün öne çıkan bir uyarı yok — planına devam et. 💪",
  };
}
