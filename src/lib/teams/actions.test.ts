import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Takım etkileşim izinleri — RLS ATLANIYOR, güvenlik tamamen koda bağlı.
//
// Bu dosyadaki tüm sorgular `createAdminClient` ile çalışıyor; yani veritabanı
// seviyesindeki RLS politikaları devrede DEĞİL. Yorum/tepki/katılım
// fonksiyonları istemciden gelen ham id ile doğrudan yazıyor, çağıranın o
// takımın üyesi olup olmadığını sormuyordu: oturumu olan herkes ÜYESİ OLMADIĞI
// gizli bir takımın gönderisine yorum yazabiliyor, etkinliğine kendini
// ekleyebiliyordu.
//
// Testler yazmanın gerçekten ENGELLENDİĞİNİ kanıtlıyor — "hata döndü"
// demekle yetinmiyor, insert'in hiç çağrılmadığını da doğruluyor.
// ============================================================================

const ME = "user-me";

/** Supabase sorgu zincirini taklit eden asgari sahte istemci. */
function makeAdmin(rows: Record<string, unknown[]>) {
  const writes: { table: string; op: string }[] = [];

  const builder = (table: string) => {
    const filters: Record<string, unknown> = {};
    const chain: Record<string, unknown> = {
      select: () => chain,
      order: () => chain,
      limit: () => chain,
      eq: (col: string, val: unknown) => { filters[col] = val; return chain; },
      maybeSingle: async () => {
        const found = (rows[table] ?? []).find((r) =>
          Object.entries(filters).every(([k, v]) => (r as Record<string, unknown>)[k] === v)
        );
        return { data: found ?? null };
      },
      insert: async () => { writes.push({ table, op: "insert" }); return { error: null }; },
      update: () => { writes.push({ table, op: "update" }); return chain; },
      delete: () => { writes.push({ table, op: "delete" }); return chain; },
    };
    return chain;
  };

  return { client: { from: builder }, writes };
}

/** Test başına değiştirilebilen veri kümesi. */
let dataset: Record<string, unknown[]> = {};
let admin = makeAdmin({});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: ME } } }) },
  }),
  createAdminClient: () => admin.client,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/observability/report-server", () => ({ reportError: async () => {} }));
// Rate limit bu testin konusu değil; her zaman geçir.
vi.mock("@/lib/security/action-guard", () => ({
  guardAction: async () => ({ ok: true }),
  LIMITS: { post: {}, reaction: {}, sensitive: {}, invite: {} },
}));

const { addComment, togglePostReaction, toggleEventJoin } = await import("./actions");

beforeEach(() => {
  dataset = {
    // "gizli-takim" gönderisi — ME bu takımın üyesi DEĞİL
    team_posts: [
      { id: "post-gizli", team_id: "gizli-takim" },
      { id: "post-benim-takimim", team_id: "benim-takimim" },
      { id: "post-kisisel", team_id: null }, // kişisel akış gönderisi
    ],
    team_events: [{ id: "event-gizli", team_id: "gizli-takim" }],
    // ME yalnızca "benim-takimim" üyesi
    team_members: [{ team_id: "benim-takimim", user_id: ME, role: "member" }],
    team_post_reactions: [],
    team_post_comments: [],
    team_event_participants: [],
  };
  admin = makeAdmin(dataset);
});

describe("addComment — üye olmayan yazamaz", () => {
  it("üyesi olmadığı takımın gönderisine yorum yazamaz", async () => {
    const r = await addComment("post-gizli", "merhaba");
    expect(r.ok).toBe(false);
    // Sadece hata dönmesi yetmez — yazma HİÇ olmamalı.
    expect(admin.writes).toHaveLength(0);
  });

  it("kendi takımının gönderisine yorum yazabilir", async () => {
    const r = await addComment("post-benim-takimim", "merhaba");
    expect(r.ok).toBe(true);
    expect(admin.writes).toContainEqual({ table: "team_post_comments", op: "insert" });
  });

  // team_id NULL = kişisel akış gönderisi (migration 0044). Takıma ait
  // olmadığı için üyelik kontrolü anlamsız; görünürlük akış katmanında.
  it("kişisel akış gönderisine yorum yazılabilir", async () => {
    const r = await addComment("post-kisisel", "merhaba");
    expect(r.ok).toBe(true);
  });

  it("olmayan gönderide hata döner", async () => {
    const r = await addComment("yok-boyle-bir-id", "merhaba");
    expect(r.ok).toBe(false);
    expect(admin.writes).toHaveLength(0);
  });
});

describe("togglePostReaction — üye olmayan tepki bırakamaz", () => {
  it("üyesi olmadığı takımın gönderisine tepki bırakamaz", async () => {
    const r = await togglePostReaction("post-gizli", "like");
    expect(r.ok).toBe(false);
    expect(admin.writes).toHaveLength(0);
  });

  it("kendi takımının gönderisine tepki bırakabilir", async () => {
    const r = await togglePostReaction("post-benim-takimim", "like");
    expect(r.ok).toBe(true);
    expect(admin.writes).toContainEqual({ table: "team_post_reactions", op: "insert" });
  });
});

describe("toggleEventJoin — üye olmayan katılamaz", () => {
  // Bu, etkinlik hatırlatma cron'unun üye olmayana bildirim göndermesine
  // yol açıyordu.
  it("üyesi olmadığı takımın etkinliğine katılamaz", async () => {
    const r = await toggleEventJoin("event-gizli");
    expect(r.ok).toBe(false);
    expect(admin.writes).toHaveLength(0);
  });

  it("olmayan etkinlikte hata döner", async () => {
    const r = await toggleEventJoin("yok-boyle-bir-id");
    expect(r.ok).toBe(false);
    expect(admin.writes).toHaveLength(0);
  });
});
