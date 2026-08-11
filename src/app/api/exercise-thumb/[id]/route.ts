// Egzersiz görseli — kamuya açık (public-domain, Unlicense) free-exercise-db'den
// gerçek egzersiz fotoğrafına yönlendirir. Eşleşme: isim → kas grubu → herhangi.
// Ağ/veri yoksa otomatik üretilen SVG'ye düşer. Dataset in-memory cache'lenir.
import { createAdminClient } from "@/lib/supabase/server";
import { normalizeMediaKey, bestExerciseMatch } from "@/lib/media/exercise-media-set";

export const runtime = "nodejs";

const DB_JSON = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const DB_IMG = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

interface Entry { key: string; muscles: string[]; url: string }
let CACHE: { at: number; entries: Entry[] } | null = null;

async function getDataset(): Promise<Entry[]> {
  if (CACHE && Date.now() - CACHE.at < 6 * 3600 * 1000) return CACHE.entries;
  try {
    const res = await fetch(DB_JSON, { next: { revalidate: 86400 } });
    if (!res.ok) return CACHE?.entries ?? [];
    const json = (await res.json()) as { name: string; primaryMuscles?: string[]; images?: string[] }[];
    const entries: Entry[] = json
      .filter((e) => e.images?.length)
      .map((e) => ({ key: normalizeMediaKey(e.name), muscles: (e.primaryMuscles ?? []).map((m) => m.toLowerCase()), url: DB_IMG + e.images![0] }));
    CACHE = { at: Date.now(), entries };
    return entries;
  } catch { return CACHE?.entries ?? []; }
}

// Türkçe kas grubu → dataset (İngilizce) kas anahtar kelimeleri.
const MUSCLE_MAP: { re: RegExp; muscles: string[] }[] = [
  { re: /göğüs|chest|pec/i, muscles: ["chest"] },
  { re: /sırt|lat|back|kanat/i, muscles: ["lats", "middle back", "lower back", "traps"] },
  { re: /omuz|deltoid|shoulder/i, muscles: ["shoulders"] },
  { re: /biceps|pazu|ön kol|kol/i, muscles: ["biceps", "forearms"] },
  { re: /triceps|arka kol/i, muscles: ["triceps"] },
  { re: /bacak|quad|ön bacak|leg/i, muscles: ["quadriceps"] },
  { re: /hamstring|arka bacak/i, muscles: ["hamstrings"] },
  { re: /kalça|glut|basen/i, muscles: ["glutes"] },
  { re: /kalf|baldır|calf/i, muscles: ["calves"] },
  { re: /karın|abs|core|ab /i, muscles: ["abdominals"] },
  { re: /trapez|trap|kabuk/i, muscles: ["traps"] },
];

function hashIdx(id: string, len: number): number {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return len ? h % len : 0;
}

const COLORS = ["#A3E635", "#38BDF8", "#FB7185", "#FBBF24", "#C084FC", "#34D399", "#F472B6", "#22D3EE"];
function esc(s: string) { return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!)); }
function svgFallback(name: string, muscle: string): Response {
  let h = 0; for (const c of muscle || name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const col = COLORS[h % COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect width="800" height="450" fill="#101012"/><g transform="translate(400 200)"><rect x="-46" y="-46" width="92" height="92" rx="22" fill="${col}" opacity="0.16"/><g stroke="${col}" stroke-width="9" stroke-linecap="round" fill="none"><line x1="-30" y1="-12" x2="-30" y2="12"/><line x1="30" y1="-12" x2="30" y2="12"/><line x1="-18" y1="-20" x2="-18" y2="20"/><line x1="18" y1="-20" x2="18" y2="20"/><line x1="-18" y1="0" x2="18" y2="0"/></g></g><text x="400" y="330" text-anchor="middle" font-family="system-ui,sans-serif" font-size="34" font-weight="700" fill="#fafafa">${esc(name)}</text></svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let name = "Egzersiz", muscle = "";
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("exercises").select("name, muscle_group").eq("id", id).maybeSingle();
    if (data) { name = data.name; muscle = data.muscle_group ?? ""; }
  } catch { /* devam */ }

  const entries = await getDataset();
  if (entries.length > 0) {
    // 1) İsim eşleşmesi (birebir hareket)
    const byName = bestExerciseMatch(normalizeMediaKey(name), entries);
    let url = byName?.url ?? null;
    // 2) Kas grubu eşleşmesi (aynı bölgeden gerçek foto)
    if (!url) {
      const mm = MUSCLE_MAP.find((m) => m.re.test(muscle));
      const pool = mm ? entries.filter((e) => e.muscles.some((mus) => mm.muscles.includes(mus))) : [];
      if (pool.length) url = pool[hashIdx(id, pool.length)].url;
    }
    // 3) Herhangi bir gerçek egzersiz fotosu (deterministik)
    if (!url) url = entries[hashIdx(id, entries.length)].url;
    if (url) {
      return new Response(null, { status: 307, headers: { location: url, "cache-control": "public, max-age=86400, s-maxage=604800" } });
    }
  }

  return svgFallback(name, muscle);
}
