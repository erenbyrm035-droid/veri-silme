// Bulanık besin araması — pg_trgm search_foods RPC üzerinden (<100ms hedef).
// GET /api/nutrition/search?q=tvk&limit=20
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchFoods } from "@/lib/nutrition/food-db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20) || 20, 50);

  const t0 = performance.now();
  const results = await searchFoods(q, limit);
  const ms = Math.round(performance.now() - t0);

  return NextResponse.json({ results, count: results.length, ms });
}
