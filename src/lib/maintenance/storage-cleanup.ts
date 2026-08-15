import "server-only";
import type { createAdminClient } from "@/lib/supabase/server";

// ============================================================================
// Depolama temizliği — YETİM dosyaları bulur (ve istenirse siler).
//
// SORUN: kullanıcı ölçümünü silince `body-photos`'taki fotoğraf, öğün kaydını
// silince `meal-photos`'taki kare, postür analizini silince
// `posture-photos`'taki üç fotoğraf bucket'ta kalıyordu. Hiçbir şey
// toplamıyordu; depolama sonsuza kadar büyüyordu.
//
// VARSAYILAN KURU ÇALIŞMA. Silme açıkça istenmeli. Yanlış bir eşleme yüzünden
// kullanıcının vücut fotoğrafını silmektense hiç silmemek yeğdir: önce rapora
// bakılır, sonra uygulanır.
//
// KAPSAM — yalnızca eşlemesi KESİN olan üç bucket:
//   body-photos     → body_photos.storage_path
//   meal-photos     → meal_photos.storage_path
//   posture-photos  → posture_analyses.photo_{front,side,back}_path
//
// Bilerek DIŞARIDA bırakılanlar:
//   team-media      → yol `team_messages.attachment` jsonb'sinin içinde ve
//                     biçimi sabit değil ({url,name,size,mime,preview}).
//                     Belirsiz eşlemeyle silme yapılmaz.
//   avatars         → `profiles.avatar_url` tam URL tutuyor, yol değil;
//                     URL'den yol çıkarmak kırılgan.
//   exercise-media, → admin içerik kataloğu. Admin bir dosyayı yükleyip
//   animations,       egzersize bağlamadan önce "yetim" görünür; silmek
//   rewards           emeği çöpe atardı.
//
// YAŞ EŞİĞİ: yalnızca `minAgeDays` (varsayılan 7) günden eski dosyalar
// değerlendirilir. Kullanıcı dosyayı yükleyip DB kaydını yazana kadar geçen
// kısa sürede dosya "yetim" görünür — o yarışta silmemek için.
// ============================================================================

type Admin = ReturnType<typeof createAdminClient>;

interface Hedef {
  bucket: string;
  tablo: string;
  /** Bu tablodaki hangi kolonlar yol tutuyor. */
  kolonlar: string[];
}

const HEDEFLER: Hedef[] = [
  { bucket: "body-photos", tablo: "body_photos", kolonlar: ["storage_path"] },
  { bucket: "meal-photos", tablo: "meal_photos", kolonlar: ["storage_path"] },
  {
    bucket: "posture-photos",
    tablo: "posture_analyses",
    kolonlar: ["photo_front_path", "photo_side_path", "photo_back_path"],
  },
];

export const VARSAYILAN_YAS_GUN = 7;
/** Tek çalıştırmada silinecek azami dosya — kaza olursa hasarı sınırlar. */
export const AZAMI_SILME = 500;

export interface BucketRaporu {
  bucket: string;
  bucketDosyaSayisi: number;
  dbKayitliYol: number;
  yetim: number;
  silinen: number;
  /** Gözle kontrol için birkaç örnek — tamamı değil (log şişmesin). */
  ornekler: string[];
}

export interface TemizlikSonucu {
  uygulandi: boolean;
  minAgeDays: number;
  toplamYetim: number;
  toplamSilinen: number;
  rapor: BucketRaporu[];
}

/** Bucket'taki tüm dosyaları (klasörler dahil) düz liste olarak toplar. */
async function bucketDosyalari(
  admin: Admin,
  bucket: string,
  prefix = "",
  derinlik = 0
): Promise<{ path: string; created_at: string | null }[]> {
  // Kullanıcı klasörleri tek seviye (`<user_id>/<dosya>`); 3 seviye fazlasıyla
  // yeterli ve sonsuz özyinelemeye karşı emniyet.
  if (derinlik > 3) return [];

  const { data, error } = await admin.storage
    .from(bucket)
    .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error || !data) return [];

  const out: { path: string; created_at: string | null }[] = [];
  for (const item of data as { name: string; id: string | null; created_at?: string }[]) {
    const tamYol = prefix ? `${prefix}/${item.name}` : item.name;
    // `id === null` → klasör (Supabase Storage böyle ayırt ediyor).
    if (item.id === null) {
      out.push(...(await bucketDosyalari(admin, bucket, tamYol, derinlik + 1)));
    } else {
      out.push({ path: tamYol, created_at: item.created_at ?? null });
    }
  }
  return out;
}

/** İlgili tablodaki TÜM yolları tek kümede toplar. */
async function dbYollari(admin: Admin, hedef: Hedef): Promise<Set<string>> {
  const kume = new Set<string>();
  const { data, error } = await admin.from(hedef.tablo).select(hedef.kolonlar.join(", "));
  if (error) throw new Error(`${hedef.tablo} okunamadı: ${error.message}`);

  for (const satir of (data ?? []) as Record<string, unknown>[]) {
    for (const k of hedef.kolonlar) {
      const v = satir[k];
      if (typeof v === "string" && v.trim()) kume.add(v.trim());
    }
  }
  return kume;
}

/**
 * Yetim dosyaları bulur; `apply` true ise siler.
 *
 * @param apply       Varsayılan false — yalnızca raporlar.
 * @param minAgeDays  Bu günden yeni dosyalara dokunulmaz.
 */
export async function runStorageCleanup(
  admin: Admin,
  { apply = false, minAgeDays = VARSAYILAN_YAS_GUN }: { apply?: boolean; minAgeDays?: number } = {}
): Promise<TemizlikSonucu> {
  const gun = Math.max(1, minAgeDays);
  const esik = Date.now() - gun * 864e5;

  const rapor: BucketRaporu[] = [];
  let toplamSilinen = 0;
  let toplamYetim = 0;

  for (const hedef of HEDEFLER) {
    const [dosyalar, kayitli] = await Promise.all([
      bucketDosyalari(admin, hedef.bucket),
      dbYollari(admin, hedef),
    ]);

    const yetimler = dosyalar.filter((d) => {
      if (kayitli.has(d.path)) return false;
      // Tarihi okunamayan dosyaya DOKUNMA: yaşını bilmeden silmek riskli.
      if (!d.created_at) return false;
      return new Date(d.created_at).getTime() < esik;
    });
    toplamYetim += yetimler.length;

    let silinen = 0;
    if (apply && yetimler.length) {
      const silinecek = yetimler.slice(0, Math.max(0, AZAMI_SILME - toplamSilinen));
      for (let i = 0; i < silinecek.length; i += 100) {
        const obek = silinecek.slice(i, i + 100).map((d) => d.path);
        const { error } = await admin.storage.from(hedef.bucket).remove(obek);
        if (error) throw new Error(`${hedef.bucket} silinemedi: ${error.message}`);
        silinen += obek.length;
      }
      toplamSilinen += silinen;
    }

    rapor.push({
      bucket: hedef.bucket,
      bucketDosyaSayisi: dosyalar.length,
      dbKayitliYol: kayitli.size,
      yetim: yetimler.length,
      silinen,
      ornekler: yetimler.slice(0, 5).map((d) => d.path),
    });
  }

  return { uygulandi: apply, minAgeDays: gun, toplamYetim, toplamSilinen, rapor };
}
