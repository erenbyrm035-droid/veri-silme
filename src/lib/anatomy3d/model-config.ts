// 3D Anatomi modeli — GLB entegrasyon yapılandırması.
// Client + server güvenli.
import { REGION_KEYS, type RegionKey } from "./regions";

/**
 * Anatomik GLB modelinin URL'i.
 * Varsayılan: TANIMSIZ → zarif 2B anatomi placeholder'ı gösterilir (kapsül YOK).
 * Gerçek GLB'ye geçmek için env ver (foto-gerçekçi model veya projeyle gelen
 * üretilmiş model):
 *   NEXT_PUBLIC_ANATOMY_MODEL_URL=/models/anatomy-male.glb          (üretilmiş)
 *   NEXT_PUBLIC_ANATOMY_MODEL_URL=https://…/anatomy/male.glb        (foto-gerçekçi)
 */
const ENV_URL = process.env.NEXT_PUBLIC_ANATOMY_MODEL_URL?.trim();
export const ANATOMY_MODEL_URL: string | null =
  ENV_URL && ENV_URL !== "none" ? ENV_URL : null;

/**
 * GLB içindeki mesh adı (küçük harf) → kas bölgesi eşlemesi.
 * Çoğu anatomik model Latince/İngilizce mesh adları kullanır; alt-string
 * eşleşmesiyle bölgeye bağlanır. Model değişirse yalnızca bu tablo güncellenir.
 */
export const MESH_REGION_RULES: { match: RegExp; region: RegionKey }[] = [
  { match: /pectoral|chest|pec/i, region: "chest" },
  { match: /deltoid|shoulder/i, region: "shoulders" },
  { match: /biceps_brachii|biceps|brachialis/i, region: "biceps" },
  { match: /triceps/i, region: "triceps" },
  { match: /forearm|brachioradialis|flexor|extensor|carpi/i, region: "forearms" },
  { match: /rectus_abdominis|abdominis|abs\b/i, region: "abs" },
  { match: /oblique|transvers/i, region: "obliques" },
  { match: /trapezius|trap|levator/i, region: "traps" },
  { match: /latissimus|lat_|rhomboid|teres/i, region: "lats" },
  { match: /erector|spinae|lumbar/i, region: "lowerback" },
  { match: /glute|gluteus/i, region: "glutes" },
  { match: /quadriceps|vastus|rectus_femoris|quad/i, region: "quads" },
  { match: /hamstring|biceps_femoris|semitendinosus|semimembranosus/i, region: "hamstrings" },
  { match: /gastrocnemius|soleus|calf|calves|tibialis/i, region: "calves" },
  { match: /sternocleidomastoid|neck|scalene/i, region: "neck" },
  { match: /adductor/i, region: "quads" },
];

/** Bir mesh adını bölgeye çözer (bulunamazsa null → o mesh cilt/nötr kalır). */
export function meshNameToRegion(name: string): RegionKey | null {
  // "chest", "chest_2" gibi doğrudan bölge-anahtarı adlarını yakala.
  const base = name.toLowerCase().replace(/[_.-]?\d+$/, "");
  if ((REGION_KEYS as string[]).includes(base)) return base as RegionKey;
  for (const r of MESH_REGION_RULES) if (r.match.test(name)) return r.region;
  return null;
}

/**
 * ÖNERİLEN MODELLER (entegrasyon notu):
 * - Z-Anatomy (CC-BY-SA 4.0): tam kas sistemi, adlandırılmış mesh'ler.
 *   Blender'da açıp gerekli kasları seçip .glb export → Supabase Storage'a yükle.
 *   Kaynak: github.com/LluisV/Z-Anatomy  (atıf zorunlu)
 * - BioDigital Human (ticari API) — en yüksek kalite, lisans gerektirir.
 * - Sketchfab/TurboSquid/CGTrader "ecorche / muscular system" GLB modelleri
 *   (model başına lisans; ticari kullanımda lisans şartlarına dikkat).
 * Format: GLB (tek dosya), kas başına ayrı mesh, mesh adları MESH_REGION_RULES
 * ile eşleşecek şekilde. Dosya boyutunu <15MB tutmak için Draco sıkıştırma önerilir.
 */
