import { describe, it, expect } from "vitest";
import { profileUpdateSchema, avatarSchema, alanEtiketi } from "./schema";

// ============================================================================
// Profil doğrulaması.
//
// Bu alanlar yalnızca ekranda durmuyor: boy/kilo/yaş/aktivite doğrudan
// `calcMacroTargets`e girip günlük kalori ve makro hedefi üretiyor. Aralık
// kontrolü bozulursa kullanıcı saçma bir kalori hedefiyle kalır ve bu hata
// beslenme, diyetisyen ve koç yüzeylerinin hepsine yayılır.
// ============================================================================

const gecerli = { full_name: "Eren", height_cm: 180, weight_kg: 80 };

describe("profileUpdateSchema — makro hesabına giren alanlar", () => {
  it("makul değerleri kabul eder", () => {
    expect(profileUpdateSchema.safeParse(gecerli).success).toBe(true);
  });

  it("fizyolojik olmayan boyu reddeder", () => {
    expect(profileUpdateSchema.safeParse({ height_cm: 99999 }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ height_cm: 10 }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ height_cm: -180 }).success).toBe(false);
  });

  it("fizyolojik olmayan kiloyu reddeder", () => {
    expect(profileUpdateSchema.safeParse({ weight_kg: 0 }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ weight_kg: 5000 }).success).toBe(false);
  });

  it("haftalık antrenman günü 0-7 aralığında", () => {
    expect(profileUpdateSchema.safeParse({ weekly_training_days: 7 }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ weekly_training_days: 8 }).success).toBe(false);
  });

  it("saçma kalori hedefini reddeder", () => {
    expect(profileUpdateSchema.safeParse({ daily_calorie_goal: 100000 }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ daily_calorie_goal: 2200 }).success).toBe(true);
  });

  it("günde 24 saatten fazla uykuyu reddeder", () => {
    expect(profileUpdateSchema.safeParse({ sleep_hours: 25 }).success).toBe(false);
  });
});

describe("profileUpdateSchema — enum'lar database.types ile aynı olmalı", () => {
  // Bu testler şemanın uydurma değerlerle yazılmasını engelliyor: burada
  // kullanılan değerler database.types.ts'teki union'ların birebir aynısı.
  it("gerçek aktivite düzeylerini kabul eder", () => {
    for (const v of ["sedentary", "light", "moderate", "active", "athlete"]) {
      expect(profileUpdateSchema.safeParse({ activity_level: v }).success, v).toBe(true);
    }
  });

  it("olmayan aktivite düzeyini reddeder", () => {
    expect(profileUpdateSchema.safeParse({ activity_level: "very_active" }).success).toBe(false);
  });

  it("gerçek beslenme hedeflerini kabul eder", () => {
    for (const v of ["gain_muscle", "lose_fat", "maintain", "performance", "strength", "endurance", "healthy"]) {
      expect(profileUpdateSchema.safeParse({ nutrition_goal: v }).success, v).toBe(true);
    }
  });

  it("gerçek antrenman ortamlarını kabul eder", () => {
    for (const v of ["home", "gym", "both", "outdoor"]) {
      expect(profileUpdateSchema.safeParse({ training_environment: v }).success, v).toBe(true);
    }
  });

  it("profesyonel deneyim düzeyi kabul edilir", () => {
    expect(profileUpdateSchema.safeParse({ experience: "professional" }).success).toBe(true);
  });
});

describe("profileUpdateSchema — güvenlik", () => {
  // .strict() olmasaydı, forma ait olmayan bir kolon profiles tablosuna
  // yazılmaya çalışılabilirdi.
  it("form dışı alanı reddeder", () => {
    expect(profileUpdateSchema.safeParse({ ...gecerli, is_premium: true }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ ...gecerli, id: "baskasi" }).success).toBe(false);
  });

  it("aşırı uzun metni reddeder", () => {
    expect(profileUpdateSchema.safeParse({ bio: "a".repeat(5000) }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ full_name: "a".repeat(500) }).success).toBe(false);
  });

  it("bozuk doğum tarihini reddeder", () => {
    expect(profileUpdateSchema.safeParse({ birth_date: "dün" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ birth_date: "1990-05-12" }).success).toBe(true);
  });
});

describe("alanEtiketi", () => {
  it("kolon adı yerine Türkçe etiket döner", () => {
    expect(alanEtiketi(["height_cm"])).toBe("Boy");
    expect(alanEtiketi(["daily_calorie_goal"])).toBe("Kalori hedefi");
  });

  it("bilinmeyen alanda kolon adına düşer", () => {
    expect(alanEtiketi(["bilinmeyen_alan"])).toBe("bilinmeyen_alan");
  });
});

describe("avatarSchema", () => {
  it("geçerli URL kabul edilir", () => {
    expect(avatarSchema.safeParse("https://x.supabase.co/a.png").success).toBe(true);
  });

  it("temizleme için null kabul edilir", () => {
    expect(avatarSchema.safeParse(null).success).toBe(true);
  });

  it("URL olmayan değer reddedilir", () => {
    expect(avatarSchema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(avatarSchema.safeParse("resim.png").success).toBe(false);
  });
});
