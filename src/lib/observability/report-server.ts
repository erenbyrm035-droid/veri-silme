import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

export type Severity = "info" | "warning" | "error" | "fatal";
export interface ReportContext {
  where?: string;
  userId?: string | null;
  severity?: Severity;
  extra?: Record<string, unknown>;
}

function serializeError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message, stack: err.stack };
  if (typeof err === "string") return { message: err };
  try { return { message: JSON.stringify(err) }; } catch { return { message: String(err) }; }
}

/**
 * Sunucu tarafı hata raporu — error_logs tablosuna yazar (best-effort) + console.
 * Asla exception fırlatmaz.
 */
export async function reportError(err: unknown, ctx: ReportContext = {}): Promise<void> {
  const { message, stack } = serializeError(err);
  const severity = ctx.severity ?? "error";
  const where = ctx.where ?? "server";
  if (severity === "warning") console.warn(`[${severity}] ${where}: ${message}`);
  else console.error(`[${severity}] ${where}: ${message}`, stack ?? "");

  try {
    const supabase = createAdminClient();
    await supabase.from("error_logs").insert({
      message: message.slice(0, 2000),
      stack: stack?.slice(0, 8000) ?? null,
      where_at: where,
      severity,
      user_id: ctx.userId ?? null,
      extra: ctx.extra ?? {},
    });
  } catch {
    // Tablo/bağlantı yoksa sessizce geç.
  }
  if (process.env.SENTRY_DSN) {
    // TODO: Sentry captureException.
  }
}
