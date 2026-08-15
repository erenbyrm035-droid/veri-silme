import { describe, it, expect, beforeEach, vi } from "vitest";
import { aiRateGuard } from "./ai-guard";

// ============================================================================
// AI uç noktası kapısı.
//
// Bu uçların HER ÇAĞRISI gerçek para harcıyor (OpenAI/Anthropic token).
// Günlük kota yalnızca Free kullanıcıya uygulanıyor — premium "sınırsız AI"
// satın aldığı için doğru davranış bu. Ama sınırsız kota, sınırsız HIZ
// demek değil: patlama sınırı olmadan tek bir premium oturum (ya da sızmış
// bir çerez) saniyede onlarca çağrıyla bütçeyi boşaltabilirdi.
//
// Testler iki şeyi birden koruyor: premium'un günlük hakkı kısıtlanmasın,
// ama yığın çağrı da durdurulsun.
// ============================================================================

/** Belirli bir profil döndüren asgari sahte Supabase istemcisi. */
function fakeSupabase(profile: Record<string, unknown>) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: profile }),
  } as unknown as Parameters<typeof aiRateGuard>[1];
  return { from: () => chain } as unknown as Parameters<typeof aiRateGuard>[1];
}

const PREMIUM = {
  is_premium: true,
  membership_type: "premium",
  premium_until: new Date(Date.now() + 30 * 864e5).toISOString(),
};
const FREE = { is_premium: false, membership_type: "free", premium_until: null };

const req = () => new Request("https://viva.test/api/ai/x", { headers: { "x-forwarded-for": "1.2.3.4" } });

/** Her test kendi kullanıcı kimliğini kullansın — sayaçlar global. */
let n = 0;
const yeniKullanici = () => `test-user-${Date.now()}-${n++}`;

beforeEach(() => {
  vi.unstubAllEnvs();
  // Upstash yapılandırılmamışsa in-memory sayaç kullanılır; test bunu ister.
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
});

describe("aiRateGuard — premium", () => {
  it("normal kullanımda geçirir", async () => {
    const res = await aiRateGuard(req(), fakeSupabase(PREMIUM), yeniKullanici());
    expect(res).toBeNull();
  });

  it("günlük kota uygulanmaz — arka arkaya birkaç istek sorunsuz", async () => {
    const uid = yeniKullanici();
    for (let i = 0; i < 5; i++) {
      expect(await aiRateGuard(req(), fakeSupabase(PREMIUM), uid), `istek ${i + 1}`).toBeNull();
    }
  });

  // ASIL KORUMA: premium sınırsız kotaya sahip ama sınırsız HIZA değil.
  it("yığın çağrıda patlama sınırına takılır ve 429 döner", async () => {
    const uid = yeniKullanici();
    let ilkRed: Response | null = null;
    for (let i = 0; i < 40; i++) {
      const res = await aiRateGuard(req(), fakeSupabase(PREMIUM), uid);
      if (res) { ilkRed = res; break; }
    }
    expect(ilkRed, "premium hiç sınırlanmadı — bütçe koruması yok").not.toBeNull();
    expect(ilkRed!.status).toBe(429);
    expect(ilkRed!.headers.get("retry-after")).toBeTruthy();
  });

  it("patlama sınırı insan kullanımını engellemeyecek kadar geniş", async () => {
    const uid = yeniKullanici();
    // Bir kullanıcının dakikada 10 AI isteği yapması zaten uçta bir senaryo.
    for (let i = 0; i < 10; i++) {
      expect(await aiRateGuard(req(), fakeSupabase(PREMIUM), uid), `istek ${i + 1}`).toBeNull();
    }
  });
});

describe("aiRateGuard — free", () => {
  it("günlük kota içinde geçirir", async () => {
    const res = await aiRateGuard(req(), fakeSupabase(FREE), yeniKullanici());
    expect(res).toBeNull();
  });

  it("günlük kota dolunca 429 döner", async () => {
    const uid = yeniKullanici();
    let ilkRed: Response | null = null;
    for (let i = 0; i < 12; i++) {
      const res = await aiRateGuard(req(), fakeSupabase(FREE), uid);
      if (res) { ilkRed = res; break; }
    }
    expect(ilkRed, "free kullanıcı hiç sınırlanmadı").not.toBeNull();
    expect(ilkRed!.status).toBe(429);
  });

  it("429 gövdesi kullanıcıya anlaşılır Türkçe mesaj taşır", async () => {
    const uid = yeniKullanici();
    let red: Response | null = null;
    for (let i = 0; i < 40 && !red; i++) red = await aiRateGuard(req(), fakeSupabase(FREE), uid);
    const body = (await red!.json()) as { error?: string };
    expect(body.error).toMatch(/istek/i);
  });
});

describe("aiRateGuard — kullanıcı ayrımı", () => {
  it("bir kullanıcının sınırı diğerini etkilemez", async () => {
    const a = yeniKullanici();
    for (let i = 0; i < 40; i++) if (await aiRateGuard(req(), fakeSupabase(PREMIUM), a)) break;
    // a sınırlandı; b temiz başlamalı
    const b = yeniKullanici();
    expect(await aiRateGuard(req(), fakeSupabase(PREMIUM), b)).toBeNull();
  });
});
