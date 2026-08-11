import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
