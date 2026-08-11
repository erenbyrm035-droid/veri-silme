#!/usr/bin/env python3
"""
Seed SQL dosyalarından egzersiz kütüphanesini çıkarır.

Beş dosya, farklı sütun kümeleri kullanıyor. Her `insert into public.exercises
(...) values` bloğunu bulup sütun listesini okuyor, sonra satırları tırnak /
parantez / array[...] yapısına saygılı biçimde ayırıyor.

Basit regex ile bölmek YETMEZ: metinlerin içinde virgül, parantez ve
kaçırılmış tırnak ('') var. Bu yüzden karakter karakter durum makinesi.

Kullanım:
    python3 scripts/export-exercises.py [cikti.json]
    (varsayılan çıktı: <repo>/exercises.json)
"""
import re, sys, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "exercises.json"

FILES = [
    ROOT / "supabase/seed.sql",
    ROOT / "supabase/seed/exercises_library.sql",
    ROOT / "supabase/seed/exercises_rich.sql",
    ROOT / "supabase/seed/exercises_full.sql",
    ROOT / "supabase/seed/exercises_wellness.sql",
]

def split_top_level(s, sep=","):
    """Tırnak ve parantez derinliğine saygılı bölme."""
    out, buf, depth, i, in_str = [], [], 0, 0, False
    while i < len(s):
        c = s[i]
        if in_str:
            if c == "'":
                # '' → kaçırılmış tek tırnak, string devam eder
                if i + 1 < len(s) and s[i + 1] == "'":
                    buf.append("''"); i += 2; continue
                in_str = False
            buf.append(c); i += 1; continue
        if c == "'":
            in_str = True; buf.append(c); i += 1; continue
        if c in "([":
            depth += 1
        elif c in ")]":
            depth -= 1
        if c == sep and depth == 0:
            out.append("".join(buf)); buf = []; i += 1; continue
        buf.append(c); i += 1
    if buf:
        out.append("".join(buf))
    return [x.strip() for x in out]

def unquote(v):
    v = v.strip()
    if v.lower() in ("null", ""):
        return None
    if v.lower() == "true":  return True
    if v.lower() == "false": return False
    if v.startswith("'") and v.endswith("'"):
        return v[1:-1].replace("''", "'")
    m = re.match(r"^array\s*\[(.*)\]$", v, re.S | re.I)
    if m:
        inner = m.group(1).strip()
        if not inner:
            return []
        return [unquote(x) for x in split_top_level(inner)]
    if v == "'{}'":
        return []
    try:
        return int(v)
    except ValueError:
        pass
    return v

def parse_file(path):
    txt = pathlib.Path(path).read_text(encoding="utf-8")
    rows = []
    # Her insert bloğunu yakala: sütunlar + values gövdesi
    for m in re.finditer(
        r"insert\s+into\s+public\.exercises\s*\((.*?)\)\s*values(.*?)(?=\n\s*(?:insert\s+into|on\s+conflict|--\s*=|$))",
        txt, re.S | re.I,
    ):
        cols = [c.strip() for c in m.group(1).replace("\n", " ").split(",")]
        body = m.group(2)
        # `on conflict ...` kuyruğunu at
        body = re.split(r"\bon\s+conflict\b", body, flags=re.I)[0]
        body = body.rstrip().rstrip(";").rstrip()

        # Satırları ayır: en üst seviyede ( ... ) grupları
        depth, in_str, start, i = 0, False, None, 0
        while i < len(body):
            c = body[i]
            if in_str:
                if c == "'":
                    if i + 1 < len(body) and body[i + 1] == "'":
                        i += 2; continue
                    in_str = False
                i += 1; continue
            if c == "'":
                in_str = True; i += 1; continue
            if c == "(":
                if depth == 0: start = i + 1
                depth += 1
            elif c == ")":
                depth -= 1
                if depth == 0 and start is not None:
                    vals = split_top_level(body[start:i])
                    if len(vals) == len(cols):
                        rows.append(dict(zip(cols, [unquote(v) for v in vals])))
                    start = None
            i += 1
    return rows

all_rows, by_file = [], {}
for f in FILES:
    r = parse_file(f)
    by_file[f] = len(r)
    all_rows.extend(r)

# Ada göre tekilleştir; SONRAKİ dosya (daha zengin veri) öncekini tamamlar.
merged = {}
for r in all_rows:
    name = (r.get("name") or "").strip()
    if not name:
        continue
    key = name.lower()
    if key not in merged:
        merged[key] = r
    else:
        for k, v in r.items():
            if v not in (None, [], "") and merged[key].get(k) in (None, [], ""):
                merged[key][k] = v

exercises = sorted(merged.values(), key=lambda x: (
    (x.get("muscle_group") or "ZZZ"), (x.get("name") or "")
))

print("=== DOSYA BAŞINA ===", file=sys.stderr)
for f, n in by_file.items():
    print(f"  {n:>4}  {f}", file=sys.stderr)
print(f"\n  toplam ham: {len(all_rows)}", file=sys.stderr)
print(f"  tekil     : {len(exercises)}", file=sys.stderr)

groups = {}
for e in exercises:
    groups.setdefault(e.get("muscle_group") or "?", []).append(e)
print("\n=== KAS GRUBU ===", file=sys.stderr)
for g, items in sorted(groups.items(), key=lambda x: -len(x[1])):
    print(f"  {len(items):>4}  {g}", file=sys.stderr)

OUT.write_text(json.dumps(exercises, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"\n→ {OUT} ({len(exercises)} egzersiz)", file=sys.stderr)
