#!/usr/bin/env python3
"""
Egzersiz isimlerini ULUSLARARASI STANDARDA çeker.

NEDEN GEREKLİ: `english_name` sütunu kelime kelime çeviriyle üretilmiş ve içinde
Türkçe kalmış ("Makine Hip Abduction", "Vücut Ağırlığı Plank"). Kullanıcı hareketi
YouTube/NASM/ACE/ExRx'te bu isimlerle arayamıyor.

YÖNTEM — SÖZLÜK ÇEVİRİSİ DEĞİL:
  Kalıntı Türkçe kelimeler kapalı ve küçük bir küme; hepsi EKİPMAN/POZİSYON
  nitelemesi. Hareketin kendisi zaten İngilizce. İki ayrı karar veriliyor:

  1) NİTELEME ÇEVRİLİR   — "Makine" → "Machine": makine varyantı gerçekten
     ayrı bir harekettir ve standart isimde geçer.
  2) NİTELEME ATILIR     — "Vücut Ağırlığı Push-Up" → "Push-Up": şınav zaten
     vücut ağırlığıyla yapılır. "Bodyweight Push-Up" diye bir standart isim yok;
     kimse öyle aramaz. Aynısı Plank/Sit-Up/Crunch/Lunge/Pull-Up için geçerli.

  AMA: niteleme atıldığında BAŞKA bir kayıtla çakışıyorsa atılmaz — o zaman
  "Bodyweight" korunur, çünkü iki farklı hareketi ayırt eden tek şey odur.

Hangi standart hareketin kastedildiği kesin anlaşılmayan kayıt UNKNOWN_REVIEW
olarak işaretlenir; tahmin edilmez.

Kullanım:
    python3 scripts/export-exercises.py                 # exercises.json üretir
    python3 scripts/standardize-exercise-names.py       # eşleme + rapor
    python3 scripts/standardize-exercise-names.py --sql # migration gövdesi
"""
import json, re, sys, pathlib, unicodedata
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Kaynak: VARSAYILAN `exercises.json` (seed dosyalarının BİRLEŞİMİ).
# Ama veritabanı `on conflict (name) do nothing` kullandığı için gerçek DB
# durumu birleşimden FARKLI olabilir — ilk (fakir) satır kazanır, sonraki
# zengin satır atlanır. Doğru eşleme için gerçek DB dökümünü ver:
#   psql -tAc "select json_agg(json_build_object('name',name,'english_name',english_name)) from exercises" > db.json
#   python3 scripts/standardize-exercise-names.py --source db.json
SRC = ROOT / "exercises.json"
if "--source" in sys.argv:
    SRC = pathlib.Path(sys.argv[sys.argv.index("--source") + 1])

# --- 1) Ekipman/pozisyon nitelemeleri ---------------------------------------
# Çevrilenler: standart isimde gerçekten yer alan nitelemeler.
CEVRILEN = {
    "Makine": "Machine",
    "Direnç Bandı": "Resistance Band",
}
# Atılanlar: hareketin adında zaten ima edilen, standart isimde YER ALMAYAN
# nitelemeler. Çakışma varsa yerine ATILMAZ_KARSILIGI konur.
ATILAN = {
    "Vücut Ağırlığı": "Bodyweight",
    "Barfiks Barı": "Pull-Up Bar",
}

# --- 1b) İSTİSNALAR — kuralın yanlış sonuç verdiği, elle belirlenmiş adlar ----
# Kuralı körü körüne uygulamak burada hatalı isim üretiyordu:
ISTISNA = {
    # "Barfiks Barı" genelde gereksiz (Pull-Up zaten barda yapılır) AMA leg
    # raise'de asıl ayırt edici odur: barda asılı yapılan hareketin standart
    # adı "Hanging Leg Raise", yatarak yapılandan farklı bir harekettir.
    "Barfiks Barı Leg Raise": "Hanging Leg Raise",
    "Barfiks Barı Knee Raise": "Hanging Knee Raise",
    # "Resistance Band Cable X" kendi içinde çelişkili: bant ve kablo ayrı
    # ekipman. Bantla yapılan varyantın standart adında "Cable" geçmez.
    "Direnç Bandı Cable Pull-Through": "Resistance Band Pull-Through",
    "Direnç Bandı Cable Woodchop": "Resistance Band Woodchop",
}

# --- 2) english_name'i boş olan kayıtlar için elle belirlenmiş standart adlar -
# Her biri hareketin gerçek uluslararası adı; kelime çevirisi değil.
ELLE = {
    "Goblet Squat": "Goblet Squat",
    "Leg Press": "Leg Press",
    "Lunges": "Lunge",                       # standart tekil
    "Romanian Deadlift": "Romanian Deadlift",
    "Squat": "Back Squat",                   # barbell sırt squat'ı
    "Bench Press": "Barbell Bench Press",    # ekipman barbell
    "Dumbbell Press": "Dumbbell Bench Press",
    "Şınav": "Push-Up",
    "Glute Bridge": "Glute Bridge",
    "Hip Thrust": "Barbell Hip Thrust",      # ekipman barbell
    "Mountain Climber": "Mountain Climber",
    "Bacak Kaldırma": "Leg Raise",
    "Mekik": "Sit-Up",
    "Plank": "Plank",
    "Biceps Curl": "Dumbbell Biceps Curl",
    "Diamond Şınav": "Diamond Push-Up",
    "Triceps Pushdown": "Triceps Pushdown",
    "Lateral Raise": "Dumbbell Lateral Raise",
    "Omuz Press": "Dumbbell Shoulder Press",
    "Barfiks": "Pull-Up",
    "Deadlift": "Conventional Deadlift",
    "Lat Pulldown": "Lat Pulldown",
    # Bu beşi seed dosyalarında ZENGİN satırda dolu ama veritabanında BOŞ:
    # `on conflict (name) do nothing` yüzünden ilk (fakir) satır kazanıyor,
    # sonraki zengin satır atlanıyor. Birleştirilmiş JSON'a bakmak yanıltıcı;
    # bu yüzden eşleme gerçek DB durumundan üretiliyor.
    "Burpee": "Burpee",
    "Dumbbell Row": "Dumbbell Row",
    "Hamstring Esnetme": "Hamstring Stretch",
    "Kedi-Deve": "Cat-Cow",
    "Koşu Bandı": "Treadmill Running",
}

# --- 3) Alias'lar — kullanıcının arayabileceği diğer yaygın adlar ------------
ALIASES = {
    "Romanian Deadlift": ["RDL", "Romanian Barbell Deadlift"],
    "Conventional Deadlift": ["Deadlift"],
    "Back Squat": ["Barbell Squat", "Squat"],
    "Barbell Bench Press": ["Bench Press", "Flat Bench Press"],
    "Dumbbell Bench Press": ["DB Bench Press"],
    "Push-Up": ["Pushup", "Press-Up"],
    "Pull-Up": ["Pullup", "Chin-Up"],
    "Sit-Up": ["Situp"],
    "Lat Pulldown": ["Pulldown"],
    "Barbell Hip Thrust": ["Hip Thrust"],
    "Dumbbell Shoulder Press": ["Overhead Press", "Shoulder Press"],
    "Dumbbell Lateral Raise": ["Side Raise", "Lateral Raise"],
    "Dumbbell Biceps Curl": ["Biceps Curl", "Dumbbell Curl"],
    "Bulgarian Split Squat": ["Rear Foot Elevated Split Squat", "RFESS"],
    "Triceps Pushdown": ["Cable Pushdown", "Tricep Pushdown"],
    "Leg Raise": ["Lying Leg Raise"],
    "Glute Bridge": ["Hip Bridge"],
}

TRCHARS = set("çğıöşüÇĞİÖŞÜ")


def kirli(s: str) -> bool:
    """Türkçe'ye özgü harf içeriyorsa kalıntı vardır."""
    return bool(s) and any(c in TRCHARS for c in s)


def slugify(s: str) -> str:
    """Standart isimden video dosya adı üretir: 'Romanian Deadlift' → romanian-deadlift."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace("&", "and")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")


def temizle(en: str, mevcut: set[str]) -> tuple[str, str]:
    """(yeni_isim, karar) döndürür."""
    if en in ISTISNA:
        return ISTISNA[en], "STANDARDIZED"
    s = en
    for tr, eng in CEVRILEN.items():
        s = s.replace(tr, eng)
    for tr, eng in ATILAN.items():
        if tr not in s:
            continue
        atilmis = re.sub(r"\s+", " ", s.replace(tr, "")).strip()
        # Niteleme atılınca başka bir kayıtla çakışıyor mu?
        if atilmis in mevcut and atilmis != en:
            s = s.replace(tr, eng)          # ayırt edici → koru
        else:
            s = atilmis
    s = re.sub(r"\s+", " ", s).strip()
    if kirli(s):
        return en, "UNKNOWN_REVIEW"
    return s, "STANDARDIZED"


def main() -> int:
    if not SRC.exists():
        print(f"HATA: {SRC} yok. Önce scripts/export-exercises.py çalıştır.", file=sys.stderr)
        return 1
    data = json.loads(SRC.read_text(encoding="utf-8"))

    mevcut = {(e.get("english_name") or "").strip() for e in data if (e.get("english_name") or "").strip()}

    sonuc = []          # (name, eski_en, yeni_en, karar)
    for e in data:
        name = e["name"]
        eski = (e.get("english_name") or "").strip()
        if not eski:
            yeni = ELLE.get(name)
            sonuc.append((name, "", yeni or name, "STANDARDIZED" if yeni else "UNKNOWN_REVIEW"))
        elif kirli(eski):
            yeni, karar = temizle(eski, mevcut)
            sonuc.append((name, eski, yeni, karar))
        else:
            sonuc.append((name, eski, eski, "ALREADY_OK"))

    # Tekrar tespiti. İKİ TÜR AYRI RAPORLANIR:
    #   ÖNCEDEN VAR  → iki kayıt zaten aynı english_name'i taşıyordu; bu bir
    #                  veri kalitesi bulgusu, standardizasyonun sonucu değil.
    #   YENİ         → standartlaştırma iki kaydı aynı isme düşürdü; bunlar
    #                  gerçekten aynı hareketin iki kaydı olabilir.
    byname = defaultdict(list)
    for name, eski, yeni, karar in sonuc:
        if karar != "UNKNOWN_REVIEW":
            byname[yeni].append(name)
    tekrar = {k: v for k, v in byname.items() if len(v) > 1}

    eski_byname = defaultdict(list)
    for name, eski, _, _ in sonuc:
        if eski:
            eski_byname[eski].append(name)
    onceden = {k for k, v in eski_byname.items() if len(v) > 1}
    tekrar_onceden = {k: v for k, v in tekrar.items() if k in onceden}
    tekrar_yeni = {k: v for k, v in tekrar.items() if k not in onceden}

    degisen = [s for s in sonuc if s[3] == "STANDARDIZED" and s[1] != s[2]]
    unknown = [s for s in sonuc if s[3] == "UNKNOWN_REVIEW"]

    if "--sql" in sys.argv:
        emit_sql(sonuc, tekrar)
        return 0

    print("=" * 66)
    print("EGZERSİZ İSİM STANDARDİZASYON RAPORU")
    print("=" * 66)
    print(f"TOTAL EXERCISES : {len(data)}")
    print(f"STANDARDIZED    : {len([s for s in sonuc if s[3] != 'UNKNOWN_REVIEW'])}")
    print(f"RENAMED         : {len(degisen)}")
    print(f"DUPLICATES      : {len(tekrar)}  "
          f"({len(tekrar_onceden)} önceden vardı, {len(tekrar_yeni)} standardizasyondan)")
    print(f"ALIASES ADDED   : {sum(len(v) for v in ALIASES.values())} ({len(ALIASES)} harekete)")
    print(f"UNKNOWN_REVIEW  : {len(unknown)}")

    print(f"\n--- OLD NAME → NEW STANDARD NAME ({len(degisen)}) ---")
    for name, eski, yeni, _ in sorted(degisen, key=lambda x: x[2]):
        print(f"  {eski or '(boş) ' + name:<44} → {yeni}")

    if tekrar_yeni:
        print(f"\n--- DUPLICATES / STANDARDİZASYONDAN ({len(tekrar_yeni)}) ---")
        print("    Bu kayıtlar standartlaştırınca aynı isme düştü — muhtemelen")
        print("    aynı hareketin iki kaydı. Silinmedi; incelenmeli.")
        for k, v in sorted(tekrar_yeni.items()):
            print(f"  {k}")
            for n in v:
                print(f"      ← {n}")

    if tekrar_onceden:
        print(f"\n--- DUPLICATES / ÖNCEDEN VARDI ({len(tekrar_onceden)}) ---")
        print("    Bu kayıtlar ZATEN aynı english_name'i taşıyordu; standardizasyon")
        print("    yaratmadı, sadece görünür kıldı. Ayrı bir temizlik işi.")
        for k, v in sorted(tekrar_onceden.items()):
            print(f"  {k:<34} ← {' | '.join(v)}")

    if unknown:
        print(f"\n--- UNKNOWN_REVIEW ({len(unknown)}) — elle karar gerekiyor ---")
        for name, eski, _, _ in unknown:
            print(f"  {name}  (mevcut english_name: {eski or '(boş)'})")
    return 0


def emit_sql(sonuc, tekrar) -> None:
    """Migration gövdesi — yalnızca DEĞİŞEN kayıtlar için UPDATE."""
    out = []
    out.append("-- english_name standardizasyonu (üretilmiştir:")
    out.append("-- scripts/standardize-exercise-names.py --sql)")
    out.append("-- `name` sütununa DOKUNULMAZ: workout_sets.exercise_name ve")
    out.append("-- personal_records.exercise_name ona bağlı.")
    for name, eski, yeni, karar in sonuc:
        if karar == "UNKNOWN_REVIEW" or eski == yeni:
            continue
        n = name.replace("'", "''")
        y = yeni.replace("'", "''")
        out.append(f"update public.exercises set english_name = '{y}' where name = '{n}';")
    out.append("")
    out.append("-- video_slug: standart isimden türetilir")
    for name, _, yeni, karar in sonuc:
        if karar == "UNKNOWN_REVIEW":
            continue
        n = name.replace("'", "''")
        out.append(f"update public.exercises set video_slug = '{slugify(yeni)}' where name = '{n}';")
    out.append("")
    out.append("-- aliases: kullanıcının arayabileceği diğer yaygın adlar")
    for std, al in ALIASES.items():
        arr = ",".join(f"'{a.replace(chr(39), chr(39) * 2)}'" for a in al)
        s = std.replace("'", "''")
        out.append(f"update public.exercises set aliases = array[{arr}]::text[] where english_name = '{s}';")
    print("\n".join(out))


if __name__ == "__main__":
    raise SystemExit(main())
