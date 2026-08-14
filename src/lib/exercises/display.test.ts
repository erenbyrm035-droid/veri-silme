import { describe, it, expect } from "vitest";
import { displayName, displayNameFor, matchesSearch, videoSlug, type NameableExercise } from "./display";

// ============================================================================
// Egzersiz isim gösterim katmanı.
//
// `exercises.name` iç anahtar olarak Türkçe kaldı (workout_sets ve
// personal_records ona bağlı); kullanıcı standart İngilizce ismi görüyor.
// Bu katman bozulursa ya kullanıcı Türkçe isim görür ya da geçmiş kayıtlar
// isimsiz kalır — ikisi de sessizce olur.
// ============================================================================

const ex = (o: Partial<NameableExercise>): NameableExercise => ({ ...o });

describe("displayName", () => {
  it("standart İngilizce ismi tercih eder", () => {
    expect(displayName(ex({ name: "Rumen Ölü Kaldırma", english_name: "Romanian Deadlift" })))
      .toBe("Romanian Deadlift");
  });

  it("english_name yoksa iç isme düşer — boş kutu göstermez", () => {
    expect(displayName(ex({ name: "Rumen Ölü Kaldırma" }))).toBe("Rumen Ölü Kaldırma");
    expect(displayName(ex({ name: "Squat", english_name: "" }))).toBe("Squat");
    expect(displayName(ex({ name: "Squat", english_name: "   " }))).toBe("Squat");
  });

  it("null/undefined'da çökmez", () => {
    expect(displayName(null)).toBe("");
    expect(displayName(undefined)).toBe("");
    expect(displayName(ex({}))).toBe("");
  });
});

describe("displayNameFor", () => {
  const byId = new Map<string, NameableExercise>([
    ["e1", ex({ name: "Rumen Ölü Kaldırma", english_name: "Romanian Deadlift" })],
  ]);

  it("id ile güncel standart ismi çözer", () => {
    expect(displayNameFor({ exercise_id: "e1", exercise_name: "Rumen Ölü Kaldırma" }, byId))
      .toBe("Romanian Deadlift");
  });

  // Egzersiz silinmişse geçmiş kayıt isimsiz KALMAMALI.
  it("egzersiz bulunamazsa saklanan isme düşer", () => {
    expect(displayNameFor({ exercise_id: "silinmis", exercise_name: "Eski Hareket" }, byId))
      .toBe("Eski Hareket");
  });

  it("id yoksa saklanan ismi kullanır", () => {
    expect(displayNameFor({ exercise_name: "Serbest Hareket" }, byId)).toBe("Serbest Hareket");
  });

  it("hiçbiri yoksa boş döner, çökmez", () => {
    expect(displayNameFor({}, byId)).toBe("");
  });
});

describe("matchesSearch", () => {
  const rdl = ex({
    name: "Rumen Ölü Kaldırma",
    english_name: "Romanian Deadlift",
    aliases: ["RDL", "Romen Deadlift"],
  });

  it("standart isimle bulur", () => {
    expect(matchesSearch(rdl, "romanian")).toBe(true);
  });

  it("alias ile bulur", () => {
    expect(matchesSearch(rdl, "rdl")).toBe(true);
  });

  // Eski kullanıcılar hareketi Türkçe adıyla biliyor — aramadan düşmemeli.
  it("Türkçe iç isimle de bulur", () => {
    expect(matchesSearch(rdl, "rumen")).toBe(true);
  });

  it("Türkçe harf farkını yok sayar", () => {
    expect(matchesSearch(rdl, "olu")).toBe(true);
    expect(matchesSearch(rdl, "ölü")).toBe(true);
  });

  it("büyük/küçük harf duyarsız", () => {
    expect(matchesSearch(rdl, "DEADLIFT")).toBe(true);
  });

  it("boş sorgu her şeyi geçirir", () => {
    expect(matchesSearch(rdl, "")).toBe(true);
    expect(matchesSearch(rdl, "   ")).toBe(true);
  });

  it("alakasız sorguda eşleşmez", () => {
    expect(matchesSearch(rdl, "bench press")).toBe(false);
  });

  it("alias listesi yoksa çökmez", () => {
    expect(matchesSearch(ex({ english_name: "Squat" }), "squat")).toBe(true);
  });
});

describe("videoSlug", () => {
  it("standart isimden kebab-case üretir", () => {
    expect(videoSlug(ex({ english_name: "Romanian Deadlift" }))).toBe("romanian-deadlift");
  });

  it("Türkçe harfleri sadeleştirir", () => {
    expect(videoSlug(ex({ name: "Ölü Kaldırma" }))).toBe("olu-kaldirma");
  });

  it("çoklu ayraç ve baş/son tireleri temizler", () => {
    expect(videoSlug(ex({ english_name: "  Push-Up / Wide  " }))).toBe("push-up-wide");
  });

  it("isim yoksa boş döner", () => {
    expect(videoSlug(ex({}))).toBe("");
  });
});
