import { describe, it, expect } from "vitest";
import { runStorageCleanup, VARSAYILAN_YAS_GUN } from "./storage-cleanup";

// ============================================================================
// Depolama temizliği.
//
// BU TESTLERİN KORUDUĞU ŞEY GERİ DÖNÜŞÜ OLMAYAN BİR İŞLEM. Yanlış bir eşleme
// kullanıcının vücut fotoğrafını siler ve o dosya bir daha gelmez. Bu yüzden
// testler "çalışıyor mu" değil, "YANLIŞLIKLA SİLİYOR MU" sorusuna bakıyor:
//
//   1. Varsayılan kuru mu (apply verilmedikçe hiç silmiyor mu)
//   2. DB'de kaydı olan dosyaya dokunmuyor mu
//   3. Yaş eşiğinden yeni dosyaya dokunmuyor mu (yükleme yarışı)
//   4. Tarihi okunamayan dosyaya dokunmuyor mu
//   5. Tek çalıştırmada silinen sayı tavanla sınırlı mı
// ============================================================================

const gunOnce = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

/** Asgari sahte admin istemcisi: bucket listesi + tablo satırları. */
function fakeAdmin(
  bucketlar: Record<string, { name: string; id: string | null; created_at?: string }[]>,
  tablolar: Record<string, Record<string, unknown>[]>
) {
  const silinen: { bucket: string; paths: string[] }[] = [];

  const storage = {
    from: (bucket: string) => ({
      list: async (prefix: string) => {
        // Testlerde tek seviye: prefix "" ise kök listesi, değilse boş.
        if (prefix) return { data: [], error: null };
        return { data: bucketlar[bucket] ?? [], error: null };
      },
      remove: async (paths: string[]) => {
        silinen.push({ bucket, paths });
        return { error: null };
      },
    }),
  };

  const from = (tablo: string) => ({
    select: async () => ({ data: tablolar[tablo] ?? [], error: null }),
  });

  return {
    client: { storage, from } as unknown as Parameters<typeof runStorageCleanup>[0],
    silinen,
    get silinenYollar() {
      return silinen.flatMap((s) => s.paths);
    },
  };
}

const dosya = (name: string, gun: number) => ({ name, id: `id-${name}`, created_at: gunOnce(gun) });

describe("varsayılan kuru çalışma", () => {
  it("apply verilmezse HİÇBİR ŞEY silmez", async () => {
    const a = fakeAdmin(
      { "body-photos": [dosya("u1/yetim.jpg", 30)] },
      { body_photos: [] }
    );
    const r = await runStorageCleanup(a.client);
    expect(r.uygulandi).toBe(false);
    expect(r.toplamYetim).toBe(1);
    expect(r.toplamSilinen).toBe(0);
    expect(a.silinenYollar, "kuru çalışmada silme yapıldı").toHaveLength(0);
  });

  it("apply verilirse siler", async () => {
    const a = fakeAdmin(
      { "body-photos": [dosya("u1/yetim.jpg", 30)] },
      { body_photos: [] }
    );
    const r = await runStorageCleanup(a.client, { apply: true });
    expect(r.toplamSilinen).toBe(1);
    expect(a.silinenYollar).toEqual(["u1/yetim.jpg"]);
  });
});

describe("DB'de kaydı olan dosyaya dokunulmaz", () => {
  it("storage_path eşleşen dosya yetim sayılmaz", async () => {
    const a = fakeAdmin(
      { "body-photos": [dosya("u1/duran.jpg", 30), dosya("u1/yetim.jpg", 30)] },
      { body_photos: [{ storage_path: "u1/duran.jpg" }] }
    );
    await runStorageCleanup(a.client, { apply: true });
    expect(a.silinenYollar).toEqual(["u1/yetim.jpg"]);
    expect(a.silinenYollar, "kayıtlı dosya silindi").not.toContain("u1/duran.jpg");
  });

  // posture_analyses üç ayrı kolonda yol tutuyor; üçü de korunmalı.
  it("çok kolonlu tabloda her kolon korunur", async () => {
    const a = fakeAdmin(
      {
        "posture-photos": [
          dosya("u1/on.jpg", 30),
          dosya("u1/yan.jpg", 30),
          dosya("u1/arka.jpg", 30),
          dosya("u1/yetim.jpg", 30),
        ],
      },
      {
        posture_analyses: [
          { photo_front_path: "u1/on.jpg", photo_side_path: "u1/yan.jpg", photo_back_path: "u1/arka.jpg" },
        ],
      }
    );
    await runStorageCleanup(a.client, { apply: true });
    expect(a.silinenYollar).toEqual(["u1/yetim.jpg"]);
  });

  it("null/boş yol kolonları kümeyi bozmaz", async () => {
    const a = fakeAdmin(
      { "posture-photos": [dosya("u1/yetim.jpg", 30)] },
      { posture_analyses: [{ photo_front_path: null, photo_side_path: "", photo_back_path: "   " }] }
    );
    const r = await runStorageCleanup(a.client, { apply: true });
    expect(r.toplamSilinen).toBe(1);
  });
});

describe("yaş eşiği — yükleme yarışı koruması", () => {
  it("eşikten yeni dosyaya dokunulmaz", async () => {
    const a = fakeAdmin(
      { "meal-photos": [dosya("u1/yeni.jpg", 1)] },
      { meal_photos: [] }
    );
    const r = await runStorageCleanup(a.client, { apply: true });
    expect(r.toplamYetim, "yeni yüklenen dosya yetim sayıldı").toBe(0);
    expect(a.silinenYollar).toHaveLength(0);
  });

  it("eşikten eski dosya silinir", async () => {
    const a = fakeAdmin(
      { "meal-photos": [dosya("u1/eski.jpg", VARSAYILAN_YAS_GUN + 1)] },
      { meal_photos: [] }
    );
    const r = await runStorageCleanup(a.client, { apply: true });
    expect(r.toplamSilinen).toBe(1);
  });

  it("eşik parametreyle değiştirilebilir", async () => {
    const a = fakeAdmin(
      { "meal-photos": [dosya("u1/onbes.jpg", 15)] },
      { meal_photos: [] }
    );
    expect((await runStorageCleanup(a.client, { minAgeDays: 30 })).toplamYetim).toBe(0);
    expect((await runStorageCleanup(a.client, { minAgeDays: 10 })).toplamYetim).toBe(1);
  });

  // Yaşı bilinmeyen dosyayı silmek, ne kadar eski olduğunu bilmeden silmektir.
  it("created_at yoksa dokunulmaz", async () => {
    const a = fakeAdmin(
      { "body-photos": [{ name: "u1/tarihsiz.jpg", id: "x" }] },
      { body_photos: [] }
    );
    const r = await runStorageCleanup(a.client, { apply: true });
    expect(r.toplamYetim).toBe(0);
    expect(a.silinenYollar).toHaveLength(0);
  });
});

describe("hasar sınırlama", () => {
  it("tek çalıştırmada 500'den fazla silmez", async () => {
    const cok = Array.from({ length: 800 }, (_, i) => dosya(`u1/y${i}.jpg`, 30));
    const a = fakeAdmin({ "body-photos": cok }, { body_photos: [] });
    const r = await runStorageCleanup(a.client, { apply: true });
    expect(r.toplamYetim).toBe(800);
    expect(r.toplamSilinen).toBeLessThanOrEqual(500);
  });
});

describe("kapsam", () => {
  // Kapsam bilerek dar: eşlemesi belirsiz bucket'lara (team-media, avatars)
  // ve admin kataloğuna (exercise-media, animations) DOKUNULMAMALI.
  it("yalnızca üç kullanıcı bucket'ı taranır", async () => {
    const a = fakeAdmin(
      {
        "body-photos": [],
        "meal-photos": [],
        "posture-photos": [],
        "team-media": [dosya("t1/ek.jpg", 90)],
        avatars: [dosya("u1/avatar.jpg", 90)],
        "exercise-media": [dosya("squat.gif", 90)],
      },
      {}
    );
    const r = await runStorageCleanup(a.client, { apply: true });
    expect(r.rapor.map((x) => x.bucket)).toEqual(["body-photos", "meal-photos", "posture-photos"]);
    expect(a.silinenYollar, "kapsam dışı bucket'a dokunuldu").toHaveLength(0);
  });
});

describe("hata davranışı", () => {
  it("tablo okunamazsa fırlatır (sessizce her şeyi yetim saymaz)", async () => {
    const client = {
      storage: { from: () => ({ list: async () => ({ data: [dosya("u1/x.jpg", 30)], error: null }) }) },
      from: () => ({ select: async () => ({ data: null, error: { message: "izin yok" } }) }),
    } as unknown as Parameters<typeof runStorageCleanup>[0];

    // Tablo okunamadığında küme boş kalırdı ve BÜTÜN dosyalar yetim görünürdü.
    // Sessizce devam etmek yerine patlaması şart.
    await expect(runStorageCleanup(client, { apply: true })).rejects.toThrow(/okunamadı/);
  });
});
