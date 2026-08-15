import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Magic Link gönderimi.
//
// İki şeyi birden korumak gerekiyor:
//   1. HIZ SINIRI — e-posta gönderen bir uç, sınırsızsa mail bombing ve
//      adres spreyi için araçtır; Supabase e-posta kotası yanar, alan adının
//      gönderim itibarı düşer.
//   2. HESAP SAYIMI (enumeration) — yanıt, adresin kayıtlı olup olmadığına
//      göre DEĞİŞMEMELİ. Değişirse hangi e-postaların sistemde olduğu tek tek
//      sınanabilir.
// ============================================================================

const signInWithOtp = vi.fn();
let ip = "1.2.3.4";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ "x-forwarded-for": ip, host: "viva.test", origin: "https://viva.test" }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithOtp } }),
  createAdminClient: () => ({ from: () => ({ insert: async () => ({ error: null }) }) }),
}));
vi.mock("@/lib/observability/report-server", () => ({ reportError: async () => {} }));

const { sendMagicLink } = await import("./magic-link-action");

/** Sayaçlar global olduğu için her test kendi adresini/IP'sini kullanır. */
let n = 0;
const yeniEposta = () => `k${Date.now()}-${n++}@ornek.com`;

beforeEach(() => {
  signInWithOtp.mockReset();
  signInWithOtp.mockResolvedValue({ error: null });
  ip = `10.0.0.${n % 250}`;
});

describe("biçim doğrulama", () => {
  it("geçerli adresi kabul eder", async () => {
    const r = await sendMagicLink(yeniEposta());
    expect(r.ok).toBe(true);
    expect(signInWithOtp).toHaveBeenCalledOnce();
  });

  it("bozuk adreslerde Supabase'e hiç gitmez", async () => {
    for (const kotu of ["", "   ", "abc", "a@b", "@ornek.com", "bos@", "a b@c.com"]) {
      signInWithOtp.mockClear();
      const r = await sendMagicLink(kotu);
      expect(r.ok, kotu).toBe(false);
      expect(signInWithOtp, kotu).not.toHaveBeenCalled();
    }
  });

  it("aşırı uzun adresi reddeder", async () => {
    const r = await sendMagicLink("a".repeat(250) + "@ornek.com");
    expect(r.ok).toBe(false);
  });

  it("adresi küçük harfe indirip boşlukları kırpar", async () => {
    const e = yeniEposta();
    await sendMagicLink(`  ${e.toUpperCase()}  `);
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: e.toLowerCase() })
    );
  });
});

describe("hesap sayımına karşı koruma", () => {
  // Supabase "bu kullanıcı yok" dese bile kullanıcıya AYNI yanıt dönmeli.
  it("Supabase hata dönse de sonuç değişmez", async () => {
    signInWithOtp.mockResolvedValue({ error: { message: "Signups not allowed for otp" } });
    const r = await sendMagicLink(yeniEposta());
    expect(r.ok).toBe(true);
    expect(r.error).toBeUndefined();
  });

  it("Supabase istisna fırlatsa bile sonuç değişmez", async () => {
    signInWithOtp.mockRejectedValue(new Error("ağ hatası"));
    const r = await sendMagicLink(yeniEposta());
    expect(r.ok).toBe(true);
  });

  it("shouldCreateUser kapatılmamış — kapatmak kayıtsız adresi ele verirdi", async () => {
    await sendMagicLink(yeniEposta());
    const opts = signInWithOtp.mock.calls[0][0].options;
    expect(opts.shouldCreateUser).toBeUndefined();
  });
});

describe("hız sınırı", () => {
  it("aynı adrese arka arkaya gönderimi durdurur", async () => {
    const e = yeniEposta();
    ip = "192.0.2.1";
    let red: { ok: boolean; error?: string } | null = null;
    for (let i = 0; i < 6; i++) {
      const r = await sendMagicLink(e);
      if (!r.ok) { red = r; break; }
    }
    expect(red, "aynı adrese sınırsız e-posta gönderilebiliyor").not.toBeNull();
    expect(red!.error).toMatch(/dakika/);
  });

  it("tek IP'den çok adrese sprey atmayı durdurur", async () => {
    ip = "198.51.100.7";
    let red: { ok: boolean } | null = null;
    for (let i = 0; i < 15; i++) {
      const r = await sendMagicLink(yeniEposta()); // her seferinde FARKLI adres
      if (!r.ok) { red = r; break; }
    }
    expect(red, "tek IP'den sınırsız adrese e-posta atılabiliyor").not.toBeNull();
  });

  it("sınıra takılınca Supabase çağrılmaz — kota boşa harcanmasın", async () => {
    const e = yeniEposta();
    ip = "203.0.113.9";
    for (let i = 0; i < 6; i++) await sendMagicLink(e);
    const oncekiCagriSayisi = signInWithOtp.mock.calls.length;
    await sendMagicLink(e);
    expect(signInWithOtp.mock.calls.length).toBe(oncekiCagriSayisi);
  });
});

describe("yönlendirme adresi", () => {
  it("mevcut callback ucuna yönlendirir", async () => {
    await sendMagicLink(yeniEposta());
    const opts = signInWithOtp.mock.calls[0][0].options;
    expect(opts.emailRedirectTo).toMatch(/\/auth\/callback$/);
  });
});
