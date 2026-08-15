import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability/report-server";
import { runStorageCleanup, VARSAYILAN_YAS_GUN } from "@/lib/maintenance/storage-cleanup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Depolama temizliği ucu. Mantık `lib/maintenance/storage-cleanup.ts` içinde;
 * burası yalnızca yetkilendirme + parametre.
 *
 * VARSAYILAN KURU ÇALIŞMA — silme `?apply=1` ile AÇIKÇA istenmeli.
 *
 * Kullanım:
 *   GET /api/maintenance/storage-cleanup                → yalnızca rapor
 *   GET /api/maintenance/storage-cleanup?apply=1        → siler
 *   GET /api/maintenance/storage-cleanup?minAgeDays=30  → eşiği değiştirir
 *
 * `CRON_SECRET` tanımlıysa `Authorization: Bearer <secret>` zorunlu
 * (`api/teams/event-reminders` ile aynı desen).
 *
 * NOT: Vercel Hobby planı günde tek cron'a izin veriyor ve o slot
 * `event-reminders`'ta dolu. Bu yüzden temizlik oradan da çağrılıyor.
 * Pro'ya geçilirse `vercel.json`'a ayrı bir girdi eklenebilir:
 *   { "path": "/api/maintenance/storage-cleanup", "schedule": "0 3 * * 0" }
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const apply = url.searchParams.get("apply") === "1";
  const minAgeDays = Number(url.searchParams.get("minAgeDays")) || VARSAYILAN_YAS_GUN;

  try {
    const sonuc = await runStorageCleanup(createAdminClient(), { apply, minAgeDays });
    return NextResponse.json({
      ok: true,
      mod: apply ? "SİLDİ" : "kuru çalışma (silmek için ?apply=1)",
      ...sonuc,
    });
  } catch (err) {
    await reportError(err, { where: "maintenance/storage-cleanup" });
    return NextResponse.json({ ok: false, error: "Temizlik çalıştırılamadı." }, { status: 500 });
  }
}
