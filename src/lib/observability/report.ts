// İstemci-güvenli hata raporu — sunucu (next/headers) kodu İÇERMEZ.
// Tarayıcıda: console + /api/log'a ateşle-unut POST. Sunucuda: console.
// Kalıcı DB yazımı için sunucu kodu doğrudan `report-server.ts` kullanmalı.

export type Severity = "info" | "warning" | "error" | "fatal";
export interface ReportContext {
  where?: string;
  userId?: string | null;
  severity?: Severity;
  extra?: Record<string, unknown>;
}

function serialize(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message, stack: err.stack };
  if (typeof err === "string") return { message: err };
  try { return { message: JSON.stringify(err) }; } catch { return { message: String(err) }; }
}

export function reportErrorSync(err: unknown, ctx: ReportContext = {}): void {
  const { message, stack } = serialize(err);
  const severity = ctx.severity ?? "error";
  const where = ctx.where ?? "client";
  if (severity === "warning") console.warn(`[${severity}] ${where}: ${message}`);
  else console.error(`[${severity}] ${where}: ${message}`, stack ?? "");

  if (typeof window !== "undefined") {
    try {
      const body = JSON.stringify({ message, stack, where, severity, extra: ctx.extra ?? {} });
      // Sayfa kapanırken bile iletmek için sendBeacon; yoksa fetch.
      if (navigator.sendBeacon) navigator.sendBeacon("/api/log", new Blob([body], { type: "application/json" }));
      else void fetch("/api/log", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
    } catch {
      // yut
    }
  }
}
