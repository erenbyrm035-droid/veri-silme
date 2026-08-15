import "server-only";
import type * as SentryNode from "@sentry/node";

// ============================================================================
// Sentry — yalnızca SUNUCU tarafı, tek noktadan.
//
// NEDEN `@sentry/node`, `@sentry/nextjs` DEĞİL:
//   Bu projede hata akışı zaten tek bir huniden geçiyor. İstemci hataları
//   `lib/observability/report.ts` → `/api/log` → `reportError()` yolunu
//   izliyor; sunucu hataları doğrudan `reportError()` çağırıyor. Yani tek
//   noktaya bağlamak hem istemciyi hem sunucuyu kapsıyor.
//
//   `@sentry/nextjs` bunun üstüne next.config sarmalayıcısı, istemci paketine
//   ek ağırlık ve CSP'ye yeni bir `connect-src` girdisi ister
//   (next.config.ts'teki CSP elle ayarlanmış, oraya dokunmak istemedik).
//   Kazanç: otomatik izleme (tracing). Bu turda gerekmiyor.
//
// DSN YOKSA HİÇBİR ŞEY OLMAZ: init edilmez, çağrılar sessizce boşa gider.
// Yerelde ve CI'da gürültü çıkmasın diye kasıtlı.
// ============================================================================

let sentry: typeof SentryNode | null = null;
let denendi = false;

/** SDK'yı ilk ihtiyaçta yükler. DSN yoksa kalıcı olarak null döner. */
function getSentry(): typeof SentryNode | null {
  if (denendi) return sentry;
  denendi = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const S = require("@sentry/node") as typeof SentryNode;
    S.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
      // Vercel her deploy'da commit SHA'sını veriyor — hangi sürümün hata
      // ürettiğini görebilmek için sürüm damgası.
      release: process.env.VERCEL_GIT_COMMIT_SHA,
      // Performans izleme kapalı: bu tur yalnızca hata raporlama.
      tracesSampleRate: 0,
      // Varsayılan entegrasyonlar konsolu da yakalayıp olayı ikiye katlıyor;
      // biz zaten console + error_logs + Sentry olarak üç yere yazıyoruz.
      integrations: (varsayilan) => varsayilan.filter((i) => i.name !== "Console"),
    });
    sentry = S;
  } catch (e) {
    // SDK yüklenemezse uygulama çalışmaya devam etmeli.
    console.warn("Sentry başlatılamadı:", e);
    sentry = null;
  }
  return sentry;
}

export interface SentryKapsam {
  where: string;
  severity: "info" | "warning" | "error" | "fatal";
  userId?: string | null;
  extra?: Record<string, unknown>;
}

/**
 * Hatayı Sentry'ye iletir. DSN yoksa ya da SDK patlarsa SESSİZCE geçer —
 * hata raporlamanın kendisi hata üretmemeli.
 */
export function sentryCapture(err: unknown, ctx: SentryKapsam): void {
  const S = getSentry();
  if (!S) return;
  try {
    S.withScope((scope) => {
      scope.setLevel(ctx.severity === "fatal" ? "fatal" : ctx.severity === "warning" ? "warning" : "error");
      scope.setTag("where", ctx.where);
      if (ctx.userId) scope.setUser({ id: ctx.userId });
      if (ctx.extra) scope.setExtras(ctx.extra);
      S.captureException(err);
    });
  } catch {
    // yut
  }
}

/** Sentry etkin mi — teşhis/log amaçlı. */
export function sentryEtkin(): boolean {
  return getSentry() !== null;
}
