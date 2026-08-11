#!/usr/bin/env python3
"""
Viva egzersiz kütüphanesi → PDF referans kitapçığı.

FONT NOTU: reportlab'in yerleşik Helvetica'sı Latin-1 kullanır ve Türkçe'nin
ş, ğ, ı, İ harflerini İÇERMEZ (onlar Latin-5'te). Bu yüzden sistemdeki
Liberation Sans TrueType fontu gömülüyor — aksi halde egzersiz adlarının
yarısı bozuk çıkardı.

Kullanım:
    python3 scripts/export-exercises.py            # <repo>/exercises.json üretir
    python3 scripts/build-exercise-pdf.py          # <repo>/viva-egzersiz-kutuphanesi.pdf
    python3 scripts/build-exercise-pdf.py girdi.json cikti.pdf
"""
import json, html, sys, pathlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
    Table, TableStyle, PageBreak, KeepTogether,
)
from reportlab.platypus.tableofcontents import TableOfContents

# --- Font kaydı -------------------------------------------------------------
FD = next(
    (p for p in (
        pathlib.Path("/usr/share/fonts/truetype/liberation"),   # Debian/Ubuntu
        pathlib.Path("/usr/share/fonts/liberation-sans"),        # Fedora/RHEL
        pathlib.Path("/usr/local/share/fonts/liberation"),       # elle kurulum
    ) if (p / "LiberationSans-Regular.ttf").exists()),
    None,
)
if FD is None:
    raise SystemExit(
        "Liberation Sans bulunamadı. Türkçe ş/ğ/ı/İ harfleri için gömülü TrueType\n"
        "font ŞART (reportlab'in Helvetica'sı Latin-1). Kurulum:\n"
        "  Debian/Ubuntu: apt-get install fonts-liberation\n"
        "  Fedora/RHEL  : dnf install liberation-sans-fonts"
    )
pdfmetrics.registerFont(TTFont("Lib", str(FD / "LiberationSans-Regular.ttf")))
pdfmetrics.registerFont(TTFont("Lib-B", str(FD / "LiberationSans-Bold.ttf")))
pdfmetrics.registerFont(TTFont("Lib-I", str(FD / "LiberationSans-Italic.ttf")))
pdfmetrics.registerFontFamily("Lib", normal="Lib", bold="Lib-B", italic="Lib-I")

BRAND = colors.HexColor("#16A34A")
INK   = colors.HexColor("#111827")
MUTED = colors.HexColor("#6B7280")
LINE  = colors.HexColor("#E5E7EB")
SOFT  = colors.HexColor("#F9FAFB")

def S(name, **kw):
    base = dict(fontName="Lib", fontSize=9.5, leading=13, textColor=INK)
    base.update(kw)
    return ParagraphStyle(name, **base)

st_title    = S("t",  fontName="Lib-B", fontSize=30, leading=36, alignment=TA_CENTER, textColor=INK)
st_sub      = S("s",  fontSize=12.5, leading=18, alignment=TA_CENTER, textColor=MUTED)
st_h1       = S("h1", fontName="Lib-B", fontSize=19, leading=24, textColor=BRAND, spaceBefore=2, spaceAfter=8)
st_ex       = S("ex", fontName="Lib-B", fontSize=11.5, leading=14.5, textColor=INK)
st_en       = S("en", fontName="Lib-I", fontSize=8.5, leading=11, textColor=MUTED)
st_body     = S("b",  fontSize=9, leading=12.5)
st_label    = S("l",  fontName="Lib-B", fontSize=8, leading=11, textColor=MUTED)
st_li       = S("li", fontSize=8.5, leading=11.5, leftIndent=8)
st_toc1     = S("tc", fontName="Lib-B", fontSize=11, leading=18)

def esc(x):
    return html.escape(str(x or "")).replace("\n", " ")

DIFF = {"beginner": "Başlangıç", "intermediate": "Orta", "advanced": "İleri"}
ENVI = {"home": "Ev", "gym": "Salon", "both": "Ev + Salon", "outdoor": "Açık hava"}

def as_list(v):
    if isinstance(v, list): return [str(x) for x in v if x]
    if v: return [str(v)]
    return []

# --- Doküman iskeleti -------------------------------------------------------
class Doc(BaseDocTemplate):
    """Bölüm başlıklarını içindekilere bildirir (multiBuild ile sayfa no)."""
    def afterFlowable(self, flowable):
        if hasattr(flowable, "_toc_label"):
            self.notify("TOCEntry", (0, flowable._toc_label, self.page))

def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Lib", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 12 * mm, "Viva AI Coach — Egzersiz Kütüphanesi")
    canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, str(doc.page))
    canvas.setStrokeColor(LINE); canvas.setLineWidth(0.4)
    canvas.line(18 * mm, 15.5 * mm, A4[0] - 18 * mm, 15.5 * mm)
    canvas.restoreState()

def blank(canvas, doc):
    pass

# --- Türkçe sıralama --------------------------------------------------------
TR = "aAbBcCçÇdDeEfFgGğĞhHıIiİjJkKlLmMnNoOöÖpPrRsSşŞtTuUüÜvVyYzZ"
ORD = {c: i for i, c in enumerate(TR)}
def trkey(s):
    return [ORD.get(c, 999 + ord(c)) for c in str(s)]

# --- Veri -------------------------------------------------------------------
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "exercises.json"
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "viva-egzersiz-kutuphanesi.pdf"

data = json.loads(SRC.read_text(encoding="utf-8"))

groups = {}
for e in data:
    groups.setdefault(e.get("muscle_group") or "Diğer", []).append(e)
for g in groups:
    groups[g].sort(key=lambda x: trkey(x.get("name", "")))
order = sorted(groups.keys(), key=lambda g: (-len(groups[g]), trkey(g)))

# --- Kapak ------------------------------------------------------------------
story = []
story += [
    Spacer(1, 55 * mm),
    Paragraph("Egzersiz Kütüphanesi", st_title),
    Spacer(1, 5 * mm),
    Paragraph("Viva AI Coach", st_sub),
    Spacer(1, 14 * mm),
]

kv = [
    ["Toplam hareket", f"{len(data)}"],
    ["Kas grubu", f"{len(groups)}"],
    ["Zorluk seviyesi", "Başlangıç · Orta · İleri"],
    ["Ortam", "Ev · Salon"],
]
t = Table(kv, colWidths=[45 * mm, 65 * mm], hAlign="CENTER")
t.setStyle(TableStyle([
    ("FONTNAME", (0, 0), (0, -1), "Lib-B"),
    ("FONTNAME", (1, 0), (1, -1), "Lib"),
    ("FONTSIZE", (0, 0), (-1, -1), 10),
    ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
    ("TEXTCOLOR", (1, 0), (1, -1), INK),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
]))
story += [t, Spacer(1, 20 * mm),
          Paragraph("Bu belge uygulamanın egzersiz veritabanından üretilmiştir.", st_sub),
          PageBreak()]

# --- İçindekiler ------------------------------------------------------------
story.append(Paragraph("İçindekiler", st_h1))
story.append(Spacer(1, 4 * mm))
toc = TableOfContents()
toc.levelStyles = [st_toc1]
story.append(toc)
story.append(PageBreak())

# --- Bölümler ---------------------------------------------------------------
def badge_row(e):
    bits = []
    d = DIFF.get(e.get("difficulty"), e.get("difficulty"))
    if d: bits.append(d)
    if e.get("equipment"): bits.append(str(e["equipment"]).capitalize())
    env = ENVI.get(e.get("environment"))
    if not env:
        if e.get("is_home") and e.get("is_gym"): env = "Ev + Salon"
        elif e.get("is_home"): env = "Ev"
        elif e.get("is_gym"): env = "Salon"
    if env: bits.append(env)
    if e.get("movement_type"): bits.append(str(e["movement_type"]))
    return " · ".join(bits)

def prescription(e):
    p = []
    if e.get("rec_sets"):    p.append(f"{e['rec_sets']} set")
    if e.get("rec_reps"):    p.append(f"{e['rec_reps']} tekrar")
    if e.get("rec_rest_sec"):p.append(f"{e['rec_rest_sec']} sn dinlenme")
    if e.get("tempo"):       p.append(f"tempo {e['tempo']}")
    return " · ".join(p)

for gi, g in enumerate(order):
    items = groups[g]
    head = Paragraph(f"{esc(g)}  <font size=11 color='#6B7280'>({len(items)} hareket)</font>", st_h1)
    head._toc_label = f"{g} ({len(items)})"
    story.append(head)
    story.append(Spacer(1, 1 * mm))

    for e in items:
        block = []
        title = esc(e.get("name"))
        block.append(Paragraph(title, st_ex))
        if e.get("english_name"):
            block.append(Paragraph(esc(e["english_name"]), st_en))
        b = badge_row(e)
        if b:
            block.append(Paragraph(f"<font color='#16A34A'>{esc(b)}</font>", st_label))
        block.append(Spacer(1, 1.5 * mm))

        if e.get("description"):
            block.append(Paragraph(esc(e["description"]), st_body))
            block.append(Spacer(1, 1.5 * mm))

        pres = prescription(e)
        if pres:
            block.append(Paragraph(f"<b>Öneri:</b> {esc(pres)}", st_body))
            block.append(Spacer(1, 1.5 * mm))

        prim = as_list(e.get("primary_muscles"))
        seco = as_list(e.get("secondary_muscles"))
        if prim or seco:
            line = []
            if prim: line.append(f"<b>Birincil:</b> {esc(', '.join(prim))}")
            if seco: line.append(f"<b>Yardımcı:</b> {esc(', '.join(seco))}")
            block.append(Paragraph("  ".join(line), st_body))
            block.append(Spacer(1, 1.5 * mm))

        ins = as_list(e.get("instructions"))
        if ins:
            block.append(Paragraph("Uygulama", st_label))
            for i, s in enumerate(ins, 1):
                block.append(Paragraph(f"{i}. {esc(s)}", st_li))
            block.append(Spacer(1, 1.5 * mm))

        mis = as_list(e.get("common_mistakes"))
        if mis:
            block.append(Paragraph("Sık yapılan hatalar", st_label))
            for s in mis:
                block.append(Paragraph(f"• {esc(s)}", st_li))
            block.append(Spacer(1, 1.5 * mm))

        tips = as_list(e.get("tips"))
        if tips:
            block.append(Paragraph("İpuçları", st_label))
            for s in tips:
                block.append(Paragraph(f"• {esc(s)}", st_li))

        block.append(Spacer(1, 4 * mm))
        # Egzersiz bloğu sayfa ortasında BÖLÜNMESİN — okunabilirlik için.
        story.append(KeepTogether(block))

    if gi < len(order) - 1:
        story.append(PageBreak())

# --- Üret -------------------------------------------------------------------
doc = Doc(str(OUT), pagesize=A4,
          leftMargin=18 * mm, rightMargin=18 * mm,
          topMargin=16 * mm, bottomMargin=20 * mm,
          title="Viva AI Coach — Egzersiz Kütüphanesi",
          author="Viva AI Coach", subject=f"{len(data)} egzersiz")

frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="n")
doc.addPageTemplates([
    PageTemplate(id="cover", frames=[frame], onPage=blank),
    PageTemplate(id="body",  frames=[frame], onPage=footer),
])

# İlk sayfa kapak (footer'sız), sonrası gövde
story.insert(0, Spacer(0, 0))
doc.multiBuild(story)
print(f"OK → {OUT}")
