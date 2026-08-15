// ============================================================================
// Next.js instrumentation kancası.
//
// NEDEN VAR: `reportError()` yalnızca BİZİM çağırdığımız yerlerde çalışıyor.
// Bir sayfa render'ı ya da route handler'ı beklenmedik şekilde patlarsa
// (try/catch'in dışında), o hata hiçbir yere kaydedilmiyordu — yalnızca
// Vercel'in çalışma zamanı loglarında kalıyordu.
//
// `onRequestError`, Next'in yakaladığı sunucu taraflı istisnaları bize
// veriyor. Buradan mevcut huniye bağlıyoruz; böylece error_logs tablosuna da
// Sentry'ye de düşüyor. Yeni bir yol açılmıyor, var olan yola bağlanıyor.
// ============================================================================

import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  // Edge runtime'da `server-only` modülleri (supabase admin istemcisi)
  // yüklenemez; oraya girmeden çık.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { reportError } = await import("@/lib/observability/report-server");
    await reportError(err, {
      where: `next:${context.routerKind}:${context.routePath}`,
      severity: "error",
      extra: {
        method: request.method,
        path: request.path,
        routeType: context.routeType,
        renderSource: context.renderSource,
      },
    });
  } catch {
    // Raporlamanın kendisi patlarsa isteği etkilemesin.
  }
};

export async function register() {
  // Şimdilik bir kurulum adımı yok; `onRequestError` bu dosyanın varlığıyla
  // devreye giriyor. Fonksiyon Next'in beklediği sözleşmenin parçası.
}
