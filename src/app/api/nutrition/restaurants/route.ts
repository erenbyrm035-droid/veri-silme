// Restoran modu — restoran listesi ve seçilen restoranın menüsü.
// GET /api/nutrition/restaurants           → tüm restoranlar
// GET /api/nutrition/restaurants?name=KFC  → o restoranın menü kalemleri
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listRestaurants, getRestaurantMenu } from "@/lib/nutrition/food-db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const name = new URL(request.url).searchParams.get("name");
  if (name) {
    const menu = await getRestaurantMenu(name);
    return NextResponse.json({ menu });
  }
  const restaurants = await listRestaurants();
  return NextResponse.json({ restaurants });
}
