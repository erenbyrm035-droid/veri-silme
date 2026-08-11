import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Aşağıdakiler hariç tüm istek yollarıyla eşleşir:
     * - _next/static, _next/image (statik dosyalar)
     * - favicon.ico ve statik varlıklar
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html)$).*)",
  ],
};
