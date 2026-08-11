// İstemci hata raporu alıcısı — reportErrorSync bunu çağırır.
// Oturumu varsa userId ekler; error_logs'a yazar. Sessizce 204 döner.
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability/report-server";
import { checkRateLimit, clientKey } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Log spam'ini sınırla.
  const rl = checkRateLimit(`log:${clientKey(request)}`, { limit: 30, windowMs: 60 * 1000 });
  if (!rl.ok) return new Response(null, { status: 204 });

  const body = await request.json().catch(() => null);
  if (!body?.message) return new Response(null, { status: 204 });

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* anonim olabilir */ }

  await reportError(new Error(String(body.message)), {
    where: `client:${body.where ?? "unknown"}`,
    severity: body.severity ?? "error",
    userId,
    extra: { ...(body.extra ?? {}), stack: body.stack },
  });
  return new Response(null, { status: 204 });
}
