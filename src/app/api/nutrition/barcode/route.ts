import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimitAsync, clientKey, tooManyRequests } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Barkod ile besin arama. Şimdilik yerel foods tablosunda barkod eşleşmesi
 * arar (altyapı hazır). Gelecekte harici barkod API'si buraya bağlanacak.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  // Barkod tarama kamerayla hızlı ardışık istek üretebilir, o yüzden tavan
  // geniş. Sınır yine de gerekli: her çağrı bir DB sorgusu ve dosyanın
  // yorumuna göre ileride harici barkod API'sine (ücretli olabilir) bağlanacak.
  const rl = await checkRateLimitAsync(`barcode:${clientKey(request, user.id)}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const body = await request.json().catch(() => ({}));
  const barcode: string = typeof body?.barcode === "string" ? body.barcode.trim() : "";
  if (!barcode) return NextResponse.json({ error: "Barkod gerekli." }, { status: 400 });

  const { data: food } = await supabase
    .from("foods")
    .select("*")
    .eq("barcode", barcode)
    .maybeSingle();

  if (food) return NextResponse.json({ found: true, food });

  return NextResponse.json({
    found: false,
    message:
      "Bu barkod veritabanında bulunamadı. Barkodlu ürün tarama yakında aktif olacak; şimdilik ürünü manuel ekleyebilirsin.",
  });
}
