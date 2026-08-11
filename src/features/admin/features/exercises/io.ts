/** CSV/JSON içe-dışa aktarma yardımcıları (saf fonksiyonlar, client+server). */

export const EXPORT_COLUMNS = [
  "name",
  "slug",
  "category",
  "subcategory",
  "muscle_group",
  "secondary_muscles",
  "difficulty",
  "equipment",
  "status",
  "gif_url",
  "movement_type",
  "tags",
  "calories",
  "description",
] as const;

function csvCell(value: unknown): string {
  if (value == null) return "";
  const s = Array.isArray(value) ? value.join("|") : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  const header = EXPORT_COLUMNS.join(",");
  const lines = rows.map((r) => EXPORT_COLUMNS.map((c) => csvCell(r[c])).join(","));
  return [header, ...lines].join("\n");
}

/** Basit CSV ayrıştırıcı (tırnak destekli). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((c) => c !== "")) rows.push(row); }
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => (obj[h] = r[i] ?? ""));
    return obj;
  });
}

/** İçe aktarma satırını normalize eder (dizi alanları | veya , ile ayrılır). */
export function normalizeImportRow(raw: Record<string, unknown>): Record<string, unknown> {
  const split = (v: unknown) =>
    typeof v === "string" ? v.split(/[|,]/).map((s) => s.trim()).filter(Boolean) : Array.isArray(v) ? v : [];
  return {
    ...raw,
    secondary_muscles: split(raw.secondary_muscles),
    tags: split(raw.tags),
    instructions: split(raw.instructions),
  };
}
