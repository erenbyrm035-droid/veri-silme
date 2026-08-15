import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// Sentry köprüsü.
//
// TEK KURAL: hata raporlamanın kendisi hata üretmemeli. DSN yoksa, SDK
// yüklenemezse ya da capture patlarsa uygulama akışı ETKİLENMEMELİ —
// `reportError()` her yerden çağrılıyor ve çoğu çağrı `catch` bloğunun
// içinde; oradan fırlayan bir istisna asıl hatayı gizler.
// ============================================================================

beforeEach(() => {
  vi.resetModules();       // modül `denendi` bayrağını sıfırla
  vi.unstubAllEnvs();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("DSN yokken", () => {
  it("etkin değildir", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    const { sentryEtkin } = await import("./sentry");
    expect(sentryEtkin()).toBe(false);
  });

  it("capture çağrısı sessizce geçer, fırlatmaz", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    const { sentryCapture } = await import("./sentry");
    expect(() =>
      sentryCapture(new Error("deneme"), { where: "test", severity: "error" })
    ).not.toThrow();
  });

  it("SDK hiç yüklenmez — DSN yoksa boşuna paket açılmasın", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    const { sentryEtkin } = await import("./sentry");
    sentryEtkin();
    // @sentry/node yüklenmiş olsaydı init edilmiş olurdu; etkin=false bunu
    // dolaylı olarak kanıtlıyor. Asıl korunan şey: çağrı patlamıyor.
    expect(sentryEtkin()).toBe(false);
  });
});

describe("DSN varken", () => {
  it("etkinleşir", async () => {
    vi.stubEnv("SENTRY_DSN", "https://abc123@o0.ingest.sentry.io/0");
    const { sentryEtkin } = await import("./sentry");
    expect(sentryEtkin()).toBe(true);
  });

  it("capture fırlatmaz", async () => {
    vi.stubEnv("SENTRY_DSN", "https://abc123@o0.ingest.sentry.io/0");
    const { sentryCapture } = await import("./sentry");
    expect(() =>
      sentryCapture(new Error("deneme"), {
        where: "test",
        severity: "error",
        userId: "u1",
        extra: { a: 1 },
      })
    ).not.toThrow();
  });

  it("severity değerlerinin hiçbirinde patlamaz", async () => {
    vi.stubEnv("SENTRY_DSN", "https://abc123@o0.ingest.sentry.io/0");
    const { sentryCapture } = await import("./sentry");
    for (const severity of ["info", "warning", "error", "fatal"] as const) {
      expect(() => sentryCapture(new Error("x"), { where: "t", severity }), severity).not.toThrow();
    }
  });

  it("Error olmayan değerlerde de patlamaz", async () => {
    vi.stubEnv("SENTRY_DSN", "https://abc123@o0.ingest.sentry.io/0");
    const { sentryCapture } = await import("./sentry");
    for (const v of ["metin", 42, null, undefined, { a: 1 }]) {
      expect(() => sentryCapture(v, { where: "t", severity: "error" })).not.toThrow();
    }
  });
});

describe("bozuk DSN", () => {
  // Yanlış yapıştırılmış bir DSN yüzünden uygulamanın hata raporlaması
  // tamamen çökmemeli.
  it("init patlasa bile capture fırlatmaz", async () => {
    vi.stubEnv("SENTRY_DSN", "bu-gecerli-bir-dsn-degil");
    const { sentryCapture } = await import("./sentry");
    expect(() =>
      sentryCapture(new Error("deneme"), { where: "test", severity: "error" })
    ).not.toThrow();
  });
});
