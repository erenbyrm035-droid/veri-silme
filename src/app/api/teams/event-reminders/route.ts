import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability/report-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Takım etkinliği hatırlatıcısı.
 *
 * Belirtilen pencere içinde başlayacak etkinliklerin katılımcılarına bildirim
 * gönderir. Vercel Hobby planı günde bir cron'a izin verdiği için varsayılan
 * pencere 24 saattir (günlük özet, 08:00 TR). Pro plana geçildiğinde
 * vercel.json'da saatlik zamanlamaya ve `?minutes=60`'a dönmek yeterli.
 *
 * Aynı etkinlik için iki kez bildirim gitmez — `notifications.href` üzerinden
 * kontrol edilir.
 */
export async function GET(req: Request) {
  // Vercel Cron isteklerini doğrula
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const admin = createAdminClient();
    const minutes = Math.min(
      2880,
      Math.max(15, Number(new URL(req.url).searchParams.get("minutes")) || 24 * 60)
    );
    const now = new Date();
    const until = new Date(now.getTime() + minutes * 60 * 1000);

    const { data: events } = await admin
      .from("team_events")
      .select("id, team_id, title, starts_at, location")
      .gte("starts_at", now.toISOString())
      .lte("starts_at", until.toISOString());

    const list = (events as { id: string; team_id: string; title: string; starts_at: string; location: string | null }[]) ?? [];
    if (list.length === 0) return NextResponse.json({ ok: true, sent: 0 });

    const slugByTeam = new Map<string, string>();
    const { data: teams } = await admin
      .from("teams").select("id, slug").in("id", [...new Set(list.map((e) => e.team_id))]);
    for (const t of ((teams as { id: string; slug: string }[]) ?? [])) slugByTeam.set(t.id, t.slug);

    let sent = 0;
    for (const ev of list) {
      const href = `/teams/${slugByTeam.get(ev.team_id) ?? ""}?event=${ev.id}`;

      // Zaten hatırlatma gönderildiyse atla
      const { count: already } = await admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("href", href)
        .eq("title", "Etkinlik yaklaşıyor");
      if ((already ?? 0) > 0) continue;

      const { data: parts } = await admin
        .from("team_event_participants")
        .select("user_id").eq("event_id", ev.id).eq("status", "going");
      const users = ((parts as { user_id: string }[]) ?? []).map((p) => p.user_id);
      if (users.length === 0) continue;

      const start = new Date(ev.starts_at);
      const time = start.toLocaleTimeString("tr-TR", {
        hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul",
      });
      const sameDay =
        start.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }) ===
        now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
      const day = sameDay
        ? "Bugün"
        : start.toLocaleDateString("tr-TR", { weekday: "long", timeZone: "Europe/Istanbul" });

      await admin.from("notifications").insert(
        users.map((u) => ({
          user_id: u,
          type: "info" as const,
          title: "Etkinlik yaklaşıyor",
          body: `${day} saat ${time} · ${ev.title}${ev.location ? ` · ${ev.location}` : ""}`,
          href,
        }))
      );
      sent += users.length;
    }

    const goals = await evaluateGoals(admin);
    return NextResponse.json({ ok: true, sent, goals });
  } catch (err) {
    await reportError(err, { where: "api/teams/event-reminders" });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

/**
 * Aktif hedefi olan kullanıcıların ilerlemesini değerlendirir.
 *
 * NEDEN BURADA: Vercel Hobby planı günde TEK cron'a izin veriyor ve o slot bu
 * uç noktada. Ayrı bir cron eklenemeyeceği için hedef değerlendirmesi buraya
 * bindiriliyor — iki iş de günde bir kez çalışması gereken işler.
 *
 * `evaluate_ai_goals` idempotent: ulaşılan hedefi 'achieved' yapar ve bildirim
 * gönderir, süresi geçeni 'missed' yapar, zaten kapalı olana dokunmaz. İki kez
 * çalışsa da ikinci bildirim gitmez (status artık 'active' değildir).
 *
 * Hata tek kullanıcıda kalır; biri patlarsa diğerleri değerlendirilmeye devam eder.
 */
async function evaluateGoals(admin: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data } = await admin.from("ai_goals").select("user_id").eq("status", "active");
  const users = [...new Set(((data as { user_id: string }[]) ?? []).map((g) => g.user_id))];

  let changed = 0;
  for (const userId of users) {
    try {
      const { data: n } = await admin.rpc("evaluate_ai_goals", { p_user: userId });
      changed += Number(n) || 0;
    } catch { /* tek kullanıcının hatası cron'u durdurmasın */ }
  }
  return changed;
}
