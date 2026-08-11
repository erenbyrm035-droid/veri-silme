// ============================================================================
// Hazır (şablon) program üreteci → supabase/seed/ready_programs.sql
// workout_programs (yayınlanmış) + workout_program_days + workout_program_exercises.
// Egzersizler ada göre exercises tablosuna bağlanır (exercise_id subquery).
// Idempotent: her program için upsert (slug) + günleri sil (cascade) + yeniden ekle.
// Çalıştır: node scripts/gen-programs.mjs
// ============================================================================
import { writeFileSync } from "node:fs";

const esc = (s) => String(s).replace(/'/g, "''");
const arrSql = (a) => a && a.length ? `array[${a.map((x) => `'${esc(x)}'`).join(",")}]` : `'{}'`;

// e(ad, set, tekrar, dinlenme_sn)
const e = (ex, sets, reps, rest = 30) => ({ ex, sets, reps, rest });

const PROGRAMS = [
  {
    slug: "pilates-baslangic-4h", name: "Pilates Başlangıç · 4 Hafta",
    category: "pilates", level: "beginner", gender: "both", environment: "home",
    weeks: 4, days_per_week: 3, est_minutes: 30, calories: 180,
    tags: ["pilates", "core", "mobility"],
    short: "Ekipmansız, evde mat üzerinde core ve postür temelleri.",
    desc: "Pilates’in temel mat hareketleriyle derin karın kaslarını, postürü ve gövde kontrolünü geliştirirsin. Haftada 3 gün, her hareketi kontrollü ve nefesle uygula.",
    progression: "Aynı haftalık planı 4 hafta tekrarla. Her hafta tekrar/süreyi biraz artır, hareketi daha kontrollü yap.",
    days: [
      { day: 1, title: "Core Temeli", focus: "Karın & nefes", exercises: [e("Pilates Hundred",2,"100 vuruş",30),e("Pelvik Kıvrılma",2,"10",30),e("Ölü Böcek",2,"8/taraf",30),e("Göğüs Kaldırma",2,"12",30),e("Pilates Plank",3,"20-40 sn",30)] },
      { day: 2, title: "Kalça & Denge", focus: "Kalça & stabilite", exercises: [e("Midye (Clam)",3,"12/taraf",30),e("Omuz Köprüsü (Pilates)",3,"12",30),e("Kuş Köpek (Pilates)",2,"8/taraf",30),e("Tek Bacak Germe",2,"10/taraf",30),e("Tek Ayak Duruşu",2,"30 sn/taraf",20)] },
      { day: 3, title: "Uzama & Kontrol", focus: "Esneklik & core", exercises: [e("Roll Up",2,"8",30),e("Omurga Germe",2,"8",30),e("Criss Cross",2,"10/taraf",30),e("Yüzme (Pilates)",2,"30 sn",30),e("Çocuk Duruşu",1,"60 sn",0)] },
    ],
  },
  {
    slug: "yoga-akisi-4h", name: "Yoga Akışı · Esneklik & Denge",
    category: "yoga", level: "beginner", gender: "both", environment: "home",
    weeks: 4, days_per_week: 3, est_minutes: 25, calories: 150,
    tags: ["yoga", "mobility", "flexibility"],
    short: "Nefesle akan yoga duruşları; esneklik, denge ve rahatlama.",
    desc: "Klasik yoga duruşlarını akış halinde uygularsın. Her duruşu nefesinle tut, gövdeni uzat ve dengeni geliştir. Gün sonunda gevşemeyle bitir.",
    progression: "Her hafta duruş sürelerini 5-10 sn uzat. İleri hafta Selamlama A/B akışını 2-3 tur yap.",
    days: [
      { day: 1, title: "Isınma Akışı", focus: "Tüm vücut", exercises: [e("Selamlama A",2,"3 tur",20),e("Aşağı Bakan Köpek",1,"45 sn",15),e("Kobra",2,"30 sn",15),e("Kedi-İnek",2,"10",15),e("Çocuk Duruşu",1,"60 sn",0)] },
      { day: 2, title: "Denge & Güç", focus: "Bacak & core", exercises: [e("Savaşçı I",1,"30 sn/taraf",15),e("Savaşçı II",1,"30 sn/taraf",15),e("Ağaç Duruşu",1,"30 sn/taraf",15),e("Üçgen Duruşu",1,"30 sn/taraf",15),e("Tekne Duruşu",2,"20 sn",20)] },
      { day: 3, title: "Açılma & Gevşeme", focus: "Kalça & sırt", exercises: [e("Güvercin Duruşu",1,"45 sn/taraf",15),e("Köprü Duruşu",2,"30 sn",20),e("Oturarak Öne Eğilme",1,"45 sn",15),e("Sırtüstü Bükülme",1,"30 sn/taraf",10),e("Şavasana",1,"3 dk",0)] },
    ],
  },
  {
    slug: "sabah-mobilite-2h", name: "Sabah Mobilite Rutini · 10 Dakika",
    category: "mobility", level: "beginner", gender: "both", environment: "home",
    weeks: 2, days_per_week: 7, est_minutes: 10, calories: 60,
    tags: ["mobility", "wellness"],
    short: "Her sabah 10 dakika, tüm eklemleri uyandıran mobilite akışı.",
    desc: "Güne enerjik başlamak için kısa bir mobilite akışı. Eklem hareket açıklığını açar, tutuklukları giderir. Her gün tekrarlanabilir.",
    progression: "Her gün uygula. Kendini iyi hissettikçe tekrar sayısını artır.",
    days: [
      { day: 1, title: "Tam Vücut Uyanış", focus: "Tüm eklemler", exercises: [e("Kedi-İnek",1,"10",10),e("Kol Daireleri",1,"10/yön",10),e("Kalça CARs",1,"5/taraf",10),e("90/90 Kalça Geçişi",1,"8/taraf",10),e("Dünyanın En İyi Germesi",1,"5/taraf",10),e("Solucan Yürüyüşü",1,"6",10)] },
    ],
  },
  {
    slug: "esneklik-toparlanma-4h", name: "Esneklik & Toparlanma · 4 Hafta",
    category: "flexibility", level: "beginner", gender: "both", environment: "home",
    weeks: 4, days_per_week: 3, est_minutes: 20, calories: 90,
    tags: ["flexibility", "mobility", "recovery"],
    short: "Antrenman sonrası ve dinlenme günleri için statik germe rutini.",
    desc: "Kasları uzatan, toparlanmayı hızlandıran statik germe programı. Her germeyi 20-40 sn sabit tut, nefes vererek gevşe.",
    progression: "Süreleri kademeli artır. Germeyi asla ağrıya kadar zorlama.",
    days: [
      { day: 1, title: "Alt Vücut", focus: "Bacak & kalça", exercises: [e("Hamstring Germe",1,"30 sn/taraf",10),e("Quadriceps Germe",1,"30 sn/taraf",10),e("Kalça Fleksör Germe",1,"30 sn/taraf",10),e("Baldır Germe",1,"30 sn/taraf",10),e("Figür 4 Germe",1,"30 sn/taraf",10)] },
      { day: 2, title: "Üst Vücut", focus: "Sırt & omuz", exercises: [e("Göğüs Germe (Kapı)",1,"30 sn",10),e("Lat Germe",1,"30 sn/taraf",10),e("Triceps Germe",1,"30 sn/taraf",10),e("Boyun Yan Germe",1,"20 sn/taraf",10),e("İğneden Geçirme",1,"30 sn/taraf",10)] },
      { day: 3, title: "Kalça Açıcı", focus: "Kalça & bel", exercises: [e("Kelebek Germe",1,"45 sn",10),e("Güvercin Duruşu",1,"45 sn/taraf",10),e("Piriformis Germe",1,"30 sn/taraf",10),e("Bel Rotasyon Germe",1,"30 sn/taraf",10),e("Çocuk Duruşu",1,"60 sn",0)] },
    ],
  },
  {
    slug: "core-denge-4h", name: "Core & Denge · 4 Hafta",
    category: "functional", level: "beginner", gender: "both", environment: "home",
    weeks: 4, days_per_week: 3, est_minutes: 25, calories: 160,
    tags: ["core", "balance", "functional"],
    short: "Güçlü bir merkez ve stabil denge için pilates + denge kombinasyonu.",
    desc: "Karın, bel ve kalça stabilizatörlerini güçlendirip dengeyi geliştirir. Günlük yaşam ve tüm sporlar için sağlam bir temel kurar.",
    progression: "Her hafta plank/hold sürelerini 5-10 sn uzat, denge hareketlerinde gözleri kapatmayı dene.",
    days: [
      { day: 1, title: "Merkez Gücü", focus: "Karın & bel", exercises: [e("Pilates Plank",3,"30-45 sn",30),e("Hollow Body Hold",3,"20-30 sn",30),e("Ölü Böcek",3,"10/taraf",30),e("Superman Hold",3,"20 sn",30),e("Criss Cross",2,"12/taraf",30)] },
      { day: 2, title: "Denge", focus: "Stabilite", exercises: [e("Tek Ayak Duruşu",3,"40 sn/taraf",20),e("Uçak Duruşu",3,"20 sn/taraf",30),e("Tek Ayak Deadlift (Denge)",3,"8/taraf",30),e("Topuk-Parmak Yürüyüş",2,"10 adım",20),e("Bosu Plank",2,"30 sn",30)] },
      { day: 3, title: "Kombine", focus: "Core + kalça", exercises: [e("Omuz Köprüsü (Pilates)",3,"12",30),e("Kuş Köpek (Pilates)",3,"8/taraf",30),e("Yan Plank (Yoga)",3,"20-30 sn/taraf",30),e("Midye (Clam)",3,"12/taraf",30),e("Tek Ayak Kalf",2,"12/taraf",20)] },
    ],
  },
  {
    slug: "ev-kalisteni-baslangic-6h", name: "Ev Kalisteniği · Başlangıç 6 Hafta",
    category: "calisthenics", level: "beginner", gender: "both", environment: "home",
    weeks: 6, days_per_week: 3, est_minutes: 35, calories: 250,
    tags: ["calisthenics", "muscle_gain", "strength"],
    short: "Ekipmansız, sadece vücut ağırlığıyla tüm vücut güç programı.",
    desc: "Barfiks/paralel varsa ideal; yoksa alternatifleriyle evde tüm vücudu çalıştırırsın. İtme, çekme ve bacak günleriyle dengeli gelişim.",
    progression: "Her hafta 1-2 tekrar ekle. Hareket kolaylaşınca daha zor varyanta geç (ör. diz şınav → tam şınav → elmas şınav).",
    days: [
      { day: 1, title: "İtiş", focus: "Göğüs & omuz & triceps", exercises: [e("Pike Şınav",4,"8-12",90),e("Elmas Şınav",3,"8-12",75),e("Dips (Paralel)",3,"6-10",90),e("Pseudo Planche Şınav",3,"6-10",75),e("Pilates Plank",3,"40 sn",45)] },
      { day: 2, title: "Çekiş", focus: "Sırt & biceps", exercises: [e("Avustralya Row",4,"8-12",90),e("Dar Tutuş Barfiks",3,"5-8",90),e("Superman Hold",3,"25 sn",45),e("Barfikste Bacak Kaldırma",3,"8-12",60),e("Hollow Body Hold",3,"25 sn",45)] },
      { day: 3, title: "Bacak", focus: "Quadriceps & kalça", exercises: [e("Pistol Squat",4,"5-8/taraf",90),e("Shrimp Squat",3,"6/taraf",75),e("Nordic Curl",3,"5-8",90),e("Tek Ayak Kalf",4,"12/taraf",45),e("Sissy Squat",3,"10-12",60)] },
    ],
  },
  {
    slug: "hiit-yag-yakim-4h", name: "HIIT Yağ Yakım · 4 Hafta",
    category: "hiit", level: "intermediate", gender: "both", environment: "home",
    weeks: 4, days_per_week: 4, est_minutes: 20, calories: 300,
    tags: ["hiit", "fat_burn", "endurance"],
    short: "Kısa, yoğun aralıklarla maksimum kalori yakımı — ekipmansız.",
    desc: "40 sn efor / 20 sn dinlenme formatında yüksek tempolu bir devre. Kalp atışını yükseltir, yağ yakımını ve kondisyonu artırır. Her turdan sonra 1 dk dinlen, 3-4 tur yap.",
    progression: "Her hafta bir tur ekle veya dinlenmeyi 5 sn kısalt. Isınmayı asla atlama.",
    days: [
      { day: 1, title: "Devre A", focus: "Tam vücut", exercises: [e("Jumping Jack",4,"40 sn",20),e("Dağcı",4,"40 sn",20),e("Squat Jump",4,"40 sn",20),e("Sprawl",4,"40 sn",20),e("Yüksek Diz Koşu",4,"40 sn",60)] },
      { day: 2, title: "Devre B", focus: "Alt vücut & core", exercises: [e("Skater Sıçrama",4,"40 sn",20),e("Tuck Jump",4,"30 sn",20),e("Plank Jack",4,"40 sn",20),e("Lateral Bound",4,"40 sn",20),e("Dağcı",4,"40 sn",60)] },
      { day: 3, title: "Devre C", focus: "Kondisyon", exercises: [e("İp Atlama",4,"60 sn",20),e("Broad Jump",4,"8 tekrar",30),e("Fast Feet",4,"30 sn",20),e("Jumping Jack",4,"40 sn",20),e("Hollow Body Hold",4,"30 sn",45)] },
      { day: 4, title: "Devre D", focus: "Yakım finali", exercises: [e("Squat Jump",4,"40 sn",20),e("Dağcı",4,"40 sn",20),e("Star Jump",4,"30 sn",20),e("Yüksek Diz Koşu",4,"40 sn",20),e("Plank Jack",4,"40 sn",60)] },
    ],
  },
  {
    slug: "fonksiyonel-kondisyon-4h", name: "Fonksiyonel Kondisyon · 4 Hafta",
    category: "functional", level: "intermediate", gender: "both", environment: "both",
    weeks: 4, days_per_week: 3, est_minutes: 40, calories: 320,
    tags: ["functional", "strength", "endurance"],
    short: "Kettlebell ve vücut ağırlığıyla güç + dayanıklılık kombinasyonu.",
    desc: "Fonksiyonel hareket kalıplarıyla (menteşe, taşıma, itiş) gerçek hayat gücünü ve kondisyonu birlikte geliştirir. Kettlebell veya dambıl uygundur.",
    progression: "Her hafta ağırlığı veya tur sayısını artır. Formu bozmadan yüklen.",
    days: [
      { day: 1, title: "Güç & Menteşe", focus: "Kalça & sırt", exercises: [e("Kettlebell Swing",4,"15",60),e("Türk Kalkışı",3,"3/taraf",90),e("Farmer Carry",4,"30 m",60),e("Kutu Sıçraması",4,"8",60),e("Pilates Plank",3,"45 sn",45)] },
      { day: 2, title: "Kondisyon", focus: "Tüm vücut", exercises: [e("Thruster",4,"12",60),e("Wall Ball",4,"15",60),e("Dağcı",4,"40 sn",30),e("Kettlebell Halo",3,"10/yön",45),e("Superman Hold",3,"30 sn",45)] },
      { day: 3, title: "Taşıma & Core", focus: "Stabilite", exercises: [e("Farmer Carry",4,"40 m",60),e("Türk Kalkışı",3,"3/taraf",90),e("Hollow Body Hold",4,"30 sn",45),e("Yan Plank (Yoga)",3,"30 sn/taraf",45),e("Cam Sileceği",3,"10",45)] },
    ],
  },
];

// ---------------------------------------------------------------------------
let sql = `-- ============================================================================
-- VIVA — Hazır (şablon) programlar. ${PROGRAMS.length} program.
-- Üretim: scripts/gen-programs.mjs · Supabase SQL Editor → Run. Idempotent.
-- Egzersizler ada göre public.exercises'e bağlanır (eşleşmezse exercise_id null,
-- ad yine görünür). ÖNCE exercises_wellness.sql çalıştırılmış olmalı.
-- ============================================================================

-- Wellness kategorileri
insert into public.program_categories (slug, name, sort_order) values
  ('pilates','Pilates',11),('yoga','Yoga',12),('mobility','Mobilite',13),
  ('flexibility','Esneklik',14),('wellness','Wellness',15)
on conflict (slug) do nothing;

insert into public.program_tags (slug, name) values
  ('core','Core'),('balance','Denge'),('flexibility','Esneklik'),('recovery','Toparlanma'),
  ('fat_burn','Yağ Yakımı'),('wellness','Wellness'),('pilates','Pilates'),('yoga','Yoga')
on conflict (slug) do nothing;

`;

for (const p of PROGRAMS) {
  const totalMin = p.est_minutes;
  sql += `\n-- ===== ${p.name} =====\n`;
  sql += `insert into public.workout_programs
  (slug, name, short_description, description, category, level, goal, gender, environment, weeks, days_per_week, est_minutes, calories, tags, status, sort_order)
values
  ('${esc(p.slug)}','${esc(p.name)}','${esc(p.short)}','${esc(p.desc)}','${esc(p.category)}','${esc(p.level)}',${p.goal ? `'${esc(p.goal)}'` : "null"},'${esc(p.gender)}','${esc(p.environment)}',${p.weeks},${p.days_per_week},${totalMin},${p.calories},${arrSql(p.tags)},'published',${PROGRAMS.indexOf(p)})
on conflict (slug) do update set
  name=excluded.name, short_description=excluded.short_description, description=excluded.description,
  category=excluded.category, level=excluded.level, gender=excluded.gender, environment=excluded.environment,
  weeks=excluded.weeks, days_per_week=excluded.days_per_week, est_minutes=excluded.est_minutes,
  calories=excluded.calories, tags=excluded.tags, status='published';

delete from public.workout_program_days
  where program_id = (select id from public.workout_programs where slug='${esc(p.slug)}');
`;

  // Günleri ekle
  const dayValues = p.days.map((d) =>
    `((select id from public.workout_programs where slug='${esc(p.slug)}'), 1, ${d.day}, '${esc(d.title)}', '${esc(d.focus)}', ${d.day})`
  ).join(",\n  ");
  sql += `insert into public.workout_program_days (program_id, week, day, title, focus, sort_order)
values
  ${dayValues};
`;

  // Egzersizleri ekle (gün başına)
  for (const d of p.days) {
    const exValues = d.exercises.map((x, i) =>
      `((select id from public.workout_program_days wd where wd.program_id=(select id from public.workout_programs where slug='${esc(p.slug)}') and wd.week=1 and wd.day=${d.day}), (select id from public.exercises where name='${esc(x.ex)}' limit 1), '${esc(x.ex)}', ${x.sets ?? "null"}, '${esc(x.reps)}', ${x.rest ?? "null"}, ${i})`
    ).join(",\n  ");
    sql += `insert into public.workout_program_exercises (day_id, exercise_id, exercise_name, sets, reps, rest_sec, sort_order)
values
  ${exValues};
`;
  }
}

writeFileSync(new URL("../supabase/seed/ready_programs.sql", import.meta.url), sql);
const days = PROGRAMS.reduce((a, p) => a + p.days.length, 0);
const exs = PROGRAMS.reduce((a, p) => a + p.days.reduce((b, d) => b + d.exercises.length, 0), 0);
console.log(`OK — ${PROGRAMS.length} program, ${days} gün, ${exs} egzersiz → supabase/seed/ready_programs.sql`);
