import { describe, it, expect } from "vitest";
import {
  createTeamSchema, updateTeamSchema, postBodySchema, commentBodySchema,
  messageSchema, questSchema, eventSchema, ilkHata,
} from "./schema";
import { QUEST_METRIC_LABEL, EVENT_KIND_LABEL } from "./types";

// ============================================================================
// Takım girdileri.
//
// İlgili kolonlar sınırsız `text`; bu şemalar eklenene kadar hiçbir metin
// alanında üst sınır yoktu. Server action'lar dışarıdan doğrudan POST
// edilebildiği için arayüzdeki maxlength koruma sayılmaz.
// ============================================================================

describe("createTeamSchema", () => {
  it("geçerli takımı kabul eder", () => {
    expect(createTeamSchema.safeParse({ name: "Sabahçılar", city: "İzmir" }).success).toBe(true);
  });

  it("çok kısa adı reddeder", () => {
    const r = createTeamSchema.safeParse({ name: "ab" });
    expect(r.success).toBe(false);
    if (!r.success) expect(ilkHata(r.error)).toContain("3 karakter");
  });

  it("megabaytlık açıklamayı reddeder", () => {
    expect(createTeamSchema.safeParse({ name: "Takım", description: "a".repeat(50_000) }).success).toBe(false);
  });

  it("bozuk renk kodunu reddeder", () => {
    expect(createTeamSchema.safeParse({ name: "Takım", color: "kırmızı" }).success).toBe(false);
    expect(createTeamSchema.safeParse({ name: "Takım", color: "#A3E635" }).success).toBe(true);
  });
});

describe("updateTeamSchema", () => {
  it("tek alan güncellemesine izin verir", () => {
    expect(updateTeamSchema.safeParse({ description: "yeni açıklama" }).success).toBe(true);
  });

  it("geçersiz logo adresini reddeder", () => {
    expect(updateTeamSchema.safeParse({ logo_url: "logo.png" }).success).toBe(false);
  });

  it("geçersiz katılım politikasını reddeder", () => {
    expect(updateTeamSchema.safeParse({ join_policy: "herkese_acik" }).success).toBe(false);
    expect(updateTeamSchema.safeParse({ join_policy: "request" }).success).toBe(true);
  });
});

describe("gönderi ve yorum sınırları", () => {
  it("boş gönderi reddedilir", () => {
    expect(postBodySchema.safeParse("   ").success).toBe(false);
  });

  it("1000 karakter sınırı — sosyal akışla aynı", () => {
    expect(postBodySchema.safeParse("a".repeat(1000)).success).toBe(true);
    expect(postBodySchema.safeParse("a".repeat(1001)).success).toBe(false);
  });

  it("yorum gönderiden kısa", () => {
    expect(commentBodySchema.safeParse("a".repeat(601)).success).toBe(false);
  });
});

describe("messageSchema", () => {
  it("normal mesajı kabul eder", () => {
    expect(messageSchema.safeParse({ body: "selam", kind: "text" }).success).toBe(true);
  });

  it("bahsetme listesi sınırsız olamaz — bildirim spam'i", () => {
    const cok = Array.from({ length: 51 }, () => "11111111-1111-1111-1111-111111111111");
    expect(messageSchema.safeParse({ body: "x", mentions: cok }).success).toBe(false);
  });

  it("uuid olmayan bahsetmeyi reddeder", () => {
    expect(messageSchema.safeParse({ body: "x", mentions: ["kullanici"] }).success).toBe(false);
  });
});

// Bu iki test şemanın types.ts'ten KOPYALANMADIĞINI garanti ediyor: yeni bir
// metrik/etkinlik türü eklenirse şema otomatik kabul eder, sessizce geride
// kalıp geçerli girdiyi reddetmez.
describe("enum'lar types.ts'ten türetiliyor", () => {
  it("tanımlı her görev metriği kabul edilir", () => {
    for (const m of Object.keys(QUEST_METRIC_LABEL)) {
      expect(questSchema.safeParse({ title: "Görev", metric: m, target: 10 }).success, m).toBe(true);
    }
  });

  it("tanımlı her etkinlik türü kabul edilir", () => {
    for (const k of Object.keys(EVENT_KIND_LABEL)) {
      expect(eventSchema.safeParse({ title: "Etkinlik", kind: k, startsAt: "2026-01-01" }).success, k).toBe(true);
    }
  });
});

describe("questSchema", () => {
  it("hedef pozitif olmalı", () => {
    expect(questSchema.safeParse({ title: "G", metric: "workouts", target: 0 }).success).toBe(false);
    expect(questSchema.safeParse({ title: "G", metric: "workouts", target: -5 }).success).toBe(false);
  });

  it("başlıksız görev reddedilir", () => {
    expect(questSchema.safeParse({ title: "  ", metric: "workouts", target: 5 }).success).toBe(false);
  });
});

describe("eventSchema", () => {
  it("başlangıç zamanı zorunlu", () => {
    expect(eventSchema.safeParse({ title: "E", kind: "meetup", startsAt: "" }).success).toBe(false);
  });

  it("aşırı uzun konum reddedilir", () => {
    expect(eventSchema.safeParse({
      title: "E", kind: "meetup", startsAt: "2026-01-01", location: "a".repeat(500),
    }).success).toBe(false);
  });
});
