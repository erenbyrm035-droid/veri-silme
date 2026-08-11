// ============================================================================
// Wellness egzersiz kütüphanesi üreteci — Pilates, Yoga, Mobilite, Esneme,
// Denge, Nefes + kalistenik/fonksiyonel ekstralar. Gerçek isimli hareketler.
// Çıktı: supabase/seed/exercises_wellness.sql (on conflict (name) do nothing).
// Çalıştır: node scripts/gen-exercises.mjs
// ============================================================================
import { writeFileSync } from "node:fs";

const rows = [];
const seen = new Set();
const esc = (s) => String(s).replace(/'/g, "''");
const arr = (a) => a && a.length ? `array[${a.map((x) => `'${esc(x)}'`).join(",")}]` : `'{}'`;

// Grup profili: ortak alanlar. Her egzersiz kendi ad/kas/bölge bilgisini verir.
function group(profile, list) {
  for (const it of list) {
    const [name, english, muscle, primaryCsv, region] = it;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const primary = primaryCsv ? primaryCsv.split("|") : [muscle];
    rows.push({
      name, english_name: english, muscle_group: muscle, body_region: region ?? profile.region ?? "front",
      movement_type: profile.movement_type, category: profile.category, difficulty: profile.difficulty ?? "beginner",
      equipment: profile.equipment ?? "bodyweight", environment: profile.environment ?? "home",
      is_home: profile.is_home ?? true, is_gym: profile.is_gym ?? false,
      primary_muscles: primary, secondary_muscles: profile.secondary ?? [], stabilizer_muscles: profile.stabilizers ?? ["Core"],
      exercise_goal: profile.goal, description: profile.desc(name, muscle),
      instructions: profile.instructions, tempo: profile.tempo ?? "kontrollü",
      rec_sets: profile.rec_sets ?? 3, rec_reps: profile.rec_reps ?? "10-12", rec_rest_sec: profile.rec_rest_sec ?? 45,
      common_mistakes: profile.mistakes, tips: profile.tips, media_type: "gif",
      calories: profile.calories ?? 4, average_duration_sec: profile.duration ?? 120,
    });
  }
}

// --------------------------------------------------------------------------- PİLATES
group({
  movement_type: "Pilates", category: "core", equipment: "mat", environment: "home", is_home: true, is_gym: true,
  region: "front", secondary: ["Karın","Kalça"], stabilizers: ["Transversus Abdominis","Pelvik Taban"],
  goal: ["Core Gücü","Postür","Esneklik"], tempo: "kontrollü (nefesle)", rec_sets: 2, rec_reps: "8-12 kontrollü", rec_rest_sec: 30, calories: 4, duration: 120,
  desc: (n) => `${n} — Pilates mat egzersizi. Derin karın kaslarını ve postürü çalıştırır, kontrollü nefesle uygulanır.`,
  instructions: ["Omurganı nötr pozisyonda tut, göbeği içe çek.","Hareketi yavaş ve kontrollü yap.","Nefes ritmini harekete eşle.","Boyun ve omuzları gevşek tut."],
  mistakes: ["Beli aşırı çukurlaştırmak","Nefesi tutmak","Momentumla sallanmak"],
  tips: ["Her tekrarda karnı içe çek","Hareketi nefesle yönet","Kaliteyi tekrardan üstün tut"],
}, [
  ["Pilates Hundred","The Hundred","Karın","Karın|Transversus"],
  ["Roll Up","Roll Up","Karın","Karın"],
  ["Roll Over","Roll Over","Karın","Karın|Kalça"],
  ["Tek Bacak Daireleri","Single Leg Circles","Kalça","Kalça|Karın"],
  ["Top Gibi Yuvarlanma","Rolling Like a Ball","Karın","Karın"],
  ["Tek Bacak Germe","Single Leg Stretch","Karın","Karın"],
  ["Çift Bacak Germe","Double Leg Stretch","Karın","Karın"],
  ["Makas (Pilates)","Single Straight Leg Stretch","Karın","Karın|Hamstring"],
  ["Çift Düz Bacak Germe","Double Straight Leg Stretch","Karın","Karın"],
  ["Criss Cross","Criss Cross","Karın","Obliqler|Karın"],
  ["Omurga Germe","Spine Stretch Forward","Sırt","Sırt|Hamstring","back"],
  ["Açık Bacak Sallanma","Open Leg Rocker","Karın","Karın"],
  ["Tirbuşon","Corkscrew","Karın","Karın|Obliqler"],
  ["Testere","Saw","Sırt","Obliqler|Hamstring","back"],
  ["Kuğu Dalışı","Swan Dive","Sırt","Sırt|Kalça","back"],
  ["Tek Bacak Tekme","Single Leg Kick","Kalça","Hamstring|Kalça","back"],
  ["Çift Bacak Tekme","Double Leg Kick","Sırt","Sırt|Hamstring","back"],
  ["Boyun Çekişi","Neck Pull","Karın","Karın"],
  ["Omuz Köprüsü (Pilates)","Shoulder Bridge","Kalça","Kalça|Hamstring","back"],
  ["Omurga Bükülmesi","Spine Twist","Sırt","Obliqler","back"],
  ["Jackknife","Jackknife","Karın","Karın|Kalça"],
  ["Yan Tekme Serisi","Side Kick Series","Kalça","Kalça|Obliqler"],
  ["Teaser","Teaser","Karın","Karın"],
  ["Kalça Daireleri","Hip Circles","Kalça","Kalça|Karın"],
  ["Yüzme (Pilates)","Swimming","Sırt","Sırt|Kalça","back"],
  ["Öne Bacak Çekişi","Leg Pull Front","Karın","Karın|Omuz"],
  ["Arkaya Bacak Çekişi","Leg Pull Back","Kalça","Kalça|Sırt","back"],
  ["Yan Eğilme (Pilates)","Side Bend","Omuz","Obliqler|Omuz"],
  ["Bumerang","Boomerang","Karın","Karın"],
  ["Fok","Seal","Karın","Karın"],
  ["Deniz Kızı","Mermaid","Sırt","Obliqler|Sırt","back"],
  ["Midye (Clam)","Clam","Kalça","Kalça (Gluteus Medius)"],
  ["Pilates Plank","Pilates Plank","Karın","Karın|Omuz"],
  ["Pilates Yan Plank","Pilates Side Plank","Karın","Obliqler|Omuz"],
  ["Ayak Parmağı Dokunuşu","Toe Taps","Karın","Karın"],
  ["Göğüs Kaldırma","Chest Lift","Karın","Karın"],
  ["Pelvik Kıvrılma","Pelvic Curl","Kalça","Kalça|Karın","back"],
  ["Masa Üstü Duruşu","Table Top","Karın","Karın"],
  ["Ölü Böcek","Dead Bug","Karın","Karın"],
  ["Kuş Köpek (Pilates)","Bird Dog","Sırt","Sırt|Kalça","back"],
  ["Omurga Aşağı Yuvarlama","Roll Down","Sırt","Sırt|Karın","back"],
  ["Ayakta Roll Down","Standing Roll Down","Sırt","Sırt","back"],
  ["Topuk Vuruşları","Heel Beats","Kalça","Kalça|Sırt","back"],
  ["Prone Bacak Kaldırma","Prone Leg Lifts","Kalça","Kalça|Sırt","back"],
  ["Reformer Footwork","Reformer Footwork","Bacak","Quadriceps|Kalça"],
  ["Reformer Elephant","Reformer Elephant","Sırt","Hamstring|Karın","back"],
  ["Reformer Long Stretch","Reformer Long Stretch","Karın","Karın|Omuz"],
  ["Reformer Short Box","Reformer Short Box","Karın","Karın"],
  ["Reformer Leg Circles","Reformer Leg Circles","Kalça","Kalça"],
]);

// --------------------------------------------------------------------------- YOGA
group({
  movement_type: "Yoga", category: "mobility", equipment: "mat", environment: "home", is_home: true, is_gym: false,
  region: "front", secondary: ["Sırt","Kalça"], stabilizers: ["Core"],
  goal: ["Esneklik","Denge","Nefes","Rahatlama"], tempo: "sabit tut (nefesle)", rec_sets: 1, rec_reps: "30-60 sn tut", rec_rest_sec: 20, calories: 3, duration: 90,
  desc: (n) => `${n} — Yoga duruşu. Esneklik, denge ve nefes farkındalığını geliştirir; postürü destekler.`,
  instructions: ["Duruşa yavaşça gir, nefesini derinleştir.","Omurganı uzun tut.","Duruşu belirtilen süre boyunca koru.","Nefes verirken gerilimi bırak."],
  mistakes: ["Nefesi tutmak","Eklemleri kilitlemek","Zorlayarak ağrıya girmek"],
  tips: ["Sınırında kal, ağrıya girme","Her nefeste biraz daha derinleş","Duruştan yavaş çık"],
}, [
  ["Dağ Duruşu","Mountain Pose (Tadasana)","Tüm Vücut","Postür"],
  ["Aşağı Bakan Köpek","Downward Dog","Sırt","Sırt|Hamstring|Omuz","back"],
  ["Yukarı Bakan Köpek","Upward Dog","Göğüs","Göğüs|Sırt"],
  ["Kobra","Cobra (Bhujangasana)","Sırt","Sırt|Göğüs","back"],
  ["Çocuk Duruşu","Child's Pose","Sırt","Sırt|Kalça","back"],
  ["Kedi-İnek","Cat-Cow","Sırt","Sırt|Karın","back"],
  ["Savaşçı I","Warrior I","Bacak","Quadriceps|Kalça"],
  ["Savaşçı II","Warrior II","Bacak","Quadriceps|Kalça"],
  ["Savaşçı III","Warrior III","Bacak","Kalça|Hamstring"],
  ["Üçgen Duruşu","Triangle Pose","Yan Gövde","Obliqler|Hamstring"],
  ["Ağaç Duruşu","Tree Pose","Bacak","Kalça|Ayak Bileği"],
  ["Sandalye Duruşu","Chair Pose","Bacak","Quadriceps|Kalça"],
  ["Köprü Duruşu","Bridge Pose","Kalça","Kalça|Sırt","back"],
  ["Güvercin Duruşu","Pigeon Pose","Kalça","Kalça (Piriformis)"],
  ["Kelebek Duruşu","Bound Angle Pose","Kalça","Adduktor|Kalça"],
  ["Tekne Duruşu","Boat Pose","Karın","Karın|Kalça Fleksör"],
  ["Deve Duruşu","Camel Pose","Göğüs","Göğüs|Sırt","back"],
  ["Yay Duruşu","Bow Pose","Sırt","Sırt|Göğüs","back"],
  ["Çekirge Duruşu","Locust Pose","Sırt","Sırt|Kalça","back"],
  ["Yan Plank (Yoga)","Side Plank (Vasisthasana)","Karın","Obliqler|Omuz"],
  ["Kartal Duruşu","Eagle Pose","Bacak","Kalça|Omuz"],
  ["Dansçı Duruşu","Dancer Pose","Bacak","Kalça|Quadriceps"],
  ["Yarım Ay Duruşu","Half Moon Pose","Bacak","Kalça|Obliqler"],
  ["Öne Eğilme","Standing Forward Fold","Sırt","Hamstring|Sırt","back"],
  ["Oturarak Öne Eğilme","Seated Forward Bend","Sırt","Hamstring|Sırt","back"],
  ["Balık Duruşu","Fish Pose","Göğüs","Göğüs|Boyun"],
  ["Alçak Hamle","Low Lunge","Kalça","Kalça Fleksör|Quadriceps"],
  ["Yüksek Hamle","High Lunge","Bacak","Quadriceps|Kalça"],
  ["Ters Savaşçı","Reverse Warrior","Yan Gövde","Obliqler|Bacak"],
  ["Guyabani Duruşu","Garland Pose (Malasana)","Kalça","Kalça|Ayak Bileği"],
  ["Karga Duruşu","Crow Pose","Kol","Omuz|Karın"],
  ["Omuz Duruşu","Shoulder Stand","Sırt","Sırt|Boyun","back"],
  ["Pulluk Duruşu","Plow Pose","Sırt","Sırt|Hamstring","back"],
  ["İğneden Geçirme","Thread the Needle","Sırt","Sırt|Omuz","back"],
  ["Sfenks Duruşu","Sphinx Pose","Sırt","Sırt","back"],
  ["Mutlu Bebek","Happy Baby","Kalça","Kalça|Adduktor"],
  ["Sırtüstü Bükülme","Supine Twist","Sırt","Obliqler|Sırt","back"],
  ["Lotus Duruşu","Lotus Pose","Kalça","Kalça"],
  ["Kolay Oturuş","Easy Pose","Kalça","Kalça|Postür"],
  ["Oturarak Bükülme","Seated Twist","Sırt","Obliqler|Sırt","back"],
  ["Selamlama A","Sun Salutation A","Tüm Vücut","Tüm Vücut"],
  ["Selamlama B","Sun Salutation B","Tüm Vücut","Tüm Vücut"],
  ["Kapı Duruşu","Gate Pose","Yan Gövde","Obliqler"],
  ["Baş-Diz Duruşu","Head-to-Knee Pose","Sırt","Hamstring|Sırt","back"],
  ["Şavasana","Corpse Pose (Savasana)","Tüm Vücut","Rahatlama"],
]);

// --------------------------------------------------------------------------- MOBİLİTE
group({
  movement_type: "Mobility", category: "mobility", equipment: "bodyweight", environment: "both", is_home: true, is_gym: true,
  region: "front", secondary: [], stabilizers: ["Core"],
  goal: ["Hareket Açıklığı","Isınma","Sakatlık Önleme"], tempo: "akıcı", rec_sets: 2, rec_reps: "8-10 tekrar", rec_rest_sec: 20, calories: 4, duration: 90,
  desc: (n) => `${n} — mobilite/hareketlilik çalışması. Eklem hareket açıklığını artırır, antrenman öncesi ısınmaya uygundur.`,
  instructions: ["Hareketi kontrollü ve tam açıklıkta yap.","Sıçrama/zorlama olmadan uygula.","Nefesini akıcı tut.","Her tekrarda açıklığı biraz artır."],
  mistakes: ["Çok hızlı/sert yapmak","Kısıtlı açıklıkta kalmak","Nefesi tutmak"],
  tips: ["Antrenman öncesi ideal","Ağrısız açıklıkta çalış","Simetrik uygula"],
}, [
  ["90/90 Kalça Geçişi","90/90 Hip Switch","Kalça","Kalça"],
  ["Dünyanın En İyi Germesi","World's Greatest Stretch","Kalça","Kalça|Sırt"],
  ["Torasik Rotasyon","Thoracic Rotation","Sırt","Sırt (Torasik)","back"],
  ["Ayak Bileği Mobilizasyonu","Ankle Mobilization","Ayak Bileği","Ayak Bileği"],
  ["Omuz Dislokasyonu (Çubuk)","Shoulder Dislocates","Omuz","Omuz"],
  ["Kurbağa Germesi","Frog Stretch","Kalça","Adduktor|Kalça"],
  ["Cossack Squat","Cossack Squat","Bacak","Adduktor|Kalça"],
  ["Derin Squat Bekleme","Deep Squat Hold","Kalça","Kalça|Ayak Bileği"],
  ["Boyun CARs","Neck CARs","Boyun","Boyun"],
  ["Omuz CARs","Shoulder CARs","Omuz","Omuz"],
  ["Kalça CARs","Hip CARs","Kalça","Kalça"],
  ["Skapula Şınavı","Scapula Push Up","Sırt","Serratus|Omuz","back"],
  ["Band Pull Apart","Band Pull Apart","Sırt","Arka Omuz|Sırt","back"],
  ["Duvar Kaydırma","Wall Slides","Omuz","Omuz|Sırt","back"],
  ["Prone Yüzücüler","Prone Swimmers","Sırt","Sırt|Omuz","back"],
  ["Kalça Uçağı","Hip Airplane","Kalça","Kalça|Denge"],
  ["Öne Bacak Salınımı","Leg Swings (Front)","Kalça","Kalça Fleksör|Hamstring"],
  ["Yana Bacak Salınımı","Leg Swings (Side)","Kalça","Adduktor|Abduktor"],
  ["Kol Daireleri","Arm Circles","Omuz","Omuz"],
  ["Gövde Rotasyonu","Torso Twist","Sırt","Obliqler","back"],
  ["Ayakta Yan Eğilme","Standing Side Bend","Yan Gövde","Obliqler"],
  ["Solucan Yürüyüşü","Inchworm","Sırt","Hamstring|Karın","back"],
  ["Spiderman Hamle","Spiderman Lunge","Kalça","Kalça Fleksör|Kalça"],
  ["Groiners","Groiners","Kalça","Adduktor|Kalça"],
  ["Bilek Daireleri","Wrist Circles","Ön Kol","Ön Kol"],
  ["Kanepe Germesi","Couch Stretch","Kalça","Kalça Fleksör|Quadriceps"],
  ["Pancake Germesi","Pancake Stretch","Kalça","Adduktor|Hamstring"],
  ["Jefferson Curl","Jefferson Curl","Sırt","Sırt|Hamstring","back"],
  ["Kettlebell Halo","Kettlebell Halo","Omuz","Omuz|Sırt"],
  ["Ayı Oturuşu Rotasyonu","Bear Sit Rotation","Kalça","Kalça|Sırt"],
]);

// --------------------------------------------------------------------------- ESNEME (STATİK)
group({
  movement_type: "Stretch", category: "stretch", equipment: "bodyweight", environment: "home", is_home: true, is_gym: true,
  region: "front", secondary: [], stabilizers: [],
  goal: ["Esneklik","Soğuma","Gevşeme"], tempo: "statik tut", rec_sets: 1, rec_reps: "20-40 sn tut", rec_rest_sec: 15, calories: 2, duration: 60,
  desc: (n) => `${n} — statik germe. Antrenman sonrası esneklik ve toparlanma için idealdir.`,
  instructions: ["Germeye yavaşça gir.","Hafif gerilim hissedince dur.","Nefes vererek gevşe ve süreyi bekle.","Zıplamadan sabit tut."],
  mistakes: ["Zıplayarak germek","Ağrıya kadar zorlamak","Nefesi tutmak"],
  tips: ["Soğuma için ideal","Ağrısız gerilimde kal","İki tarafı da uygula"],
}, [
  ["Hamstring Germe","Hamstring Stretch","Hamstring","Hamstring","back"],
  ["Quadriceps Germe","Quad Stretch","Quadriceps","Quadriceps"],
  ["Baldır Germe","Calf Stretch","Baldır","Baldır","back"],
  ["Kalça Fleksör Germe","Hip Flexor Stretch","Kalça","Kalça Fleksör"],
  ["Göğüs Germe (Kapı)","Doorway Chest Stretch","Göğüs","Göğüs|Omuz"],
  ["Triceps Germe","Triceps Stretch","Triceps","Triceps"],
  ["Omuz Çapraz Germe","Cross-Body Shoulder Stretch","Omuz","Omuz"],
  ["Boyun Yan Germe","Side Neck Stretch","Boyun","Boyun"],
  ["Piriformis Germe","Piriformis Stretch","Kalça","Kalça (Piriformis)"],
  ["Figür 4 Germe","Figure-4 Stretch","Kalça","Kalça"],
  ["Kelebek Germe","Butterfly Stretch","Kalça","Adduktor"],
  ["Otur-Uzan Germe","Seated Forward Reach","Sırt","Hamstring|Sırt","back"],
  ["Lat Germe","Lat Stretch","Sırt","Sırt (Latissimus)","back"],
  ["Bilek Fleksör Germe","Wrist Flexor Stretch","Ön Kol","Ön Kol"],
  ["Bilek Ekstansör Germe","Wrist Extensor Stretch","Ön Kol","Ön Kol"],
  ["Adduktor Germe","Adductor Stretch","Kalça","Adduktor"],
  ["Diz Üstü Kalça Germe","Kneeling Hip Flexor Stretch","Kalça","Kalça Fleksör"],
  ["Levator Scapulae Germe","Levator Scapulae Stretch","Boyun","Boyun|Sırt","back"],
  ["Overhead Triceps Germe","Overhead Triceps Stretch","Triceps","Triceps"],
  ["Duvar Baldır Germe","Wall Calf Stretch","Baldır","Baldır","back"],
  ["Koşucu Hamlesi Germe","Runner's Lunge Stretch","Kalça","Kalça Fleksör|Hamstring"],
  ["Kobra Germe","Cobra Stretch","Karın","Karın|Sırt"],
  ["Bel Rotasyon Germe","Lower Back Rotation Stretch","Sırt","Sırt|Obliqler","back"],
  ["Boyun Öne Germe","Neck Forward Stretch","Boyun","Boyun"],
]);

// --------------------------------------------------------------------------- DENGE
group({
  movement_type: "Balance", category: "balance", equipment: "bodyweight", environment: "both", is_home: true, is_gym: true,
  region: "front", secondary: ["Kalça","Karın"], stabilizers: ["Ayak Bileği","Core"],
  goal: ["Denge","Stabilizasyon","Koordinasyon"], tempo: "kontrollü", rec_sets: 3, rec_reps: "20-40 sn / taraf", rec_rest_sec: 30, calories: 3, duration: 90,
  desc: (n) => `${n} — denge ve stabilizasyon çalışması. Ayak bileği, core ve propriosepsiyonu geliştirir.`,
  instructions: ["Sabit bir noktaya bak.","Karnını hafif kas.","Dengeyi küçük düzeltmelerle koru.","Yavaş ve kontrollü uygula."],
  mistakes: ["Nefesi tutmak","Bakışı sabitlememek","Aşırı sallanmak"],
  tips: ["Gözü sabit tut","Zorlaşınca gözleri kapatarak ilerlet","Yalın ayak dene"],
}, [
  ["Tek Ayak Duruşu","Single-Leg Stance","Bacak","Kalça|Ayak Bileği"],
  ["Tek Ayak (Gözler Kapalı)","Single-Leg Stance (Eyes Closed)","Bacak","Kalça|Ayak Bileği"],
  ["Bosu Squat","Bosu Squat","Bacak","Quadriceps|Kalça"],
  ["Yıldız Denge","Star Balance (Y-Reach)","Bacak","Kalça|Core"],
  ["Tek Ayak Deadlift (Denge)","Single-Leg Balance Deadlift","Hamstring","Hamstring|Kalça","back"],
  ["Tandem Duruş","Tandem Stance","Bacak","Ayak Bileği|Core"],
  ["Topuk-Parmak Yürüyüş","Heel-to-Toe Walk","Bacak","Ayak Bileği|Core"],
  ["Tek Ayak Uzanma","Single-Leg Reach","Bacak","Kalça|Core"],
  ["Uçak Duruşu","Airplane Balance","Kalça","Kalça|Sırt","back"],
  ["Wobble Board Denge","Wobble Board Balance","Bacak","Ayak Bileği|Core"],
  ["Tek Ayak Kalf","Single-Leg Calf Raise","Baldır","Baldır|Ayak Bileği","back"],
  ["Flamingo Duruşu","Flamingo Hold","Bacak","Kalça|Ayak Bileği"],
  ["Tek Ayak Salınım","Single-Leg Swing","Kalça","Kalça|Core"],
  ["Bosu Plank","Bosu Plank","Karın","Karın|Omuz"],
]);

// --------------------------------------------------------------------------- NEFES
group({
  movement_type: "Nefes", category: "cooldown", equipment: "bodyweight", environment: "home", is_home: true, is_gym: false,
  region: "front", secondary: [], stabilizers: ["Diyafram"],
  goal: ["Rahatlama","Toparlanma","Odak"], tempo: "yavaş", rec_sets: 1, rec_reps: "3-5 dakika", rec_rest_sec: 0, calories: 1, duration: 180,
  desc: (n) => `${n} — nefes çalışması. Parasempatik sistemi aktive eder, stresi azaltır ve toparlanmayı destekler.`,
  instructions: ["Rahat bir pozisyon al.","Burnundan yavaş nefes al.","Karnını şişir, göğsü sabit tut.","Nefesi yavaşça ver ve tekrarla."],
  mistakes: ["Göğüsten sığ nefes almak","Aceleye getirmek","Omuzları kaldırmak"],
  tips: ["Nefes verişi alıştan uzun tut","Sessiz bir ortam seç","Düzenli pratikle kolaylaşır"],
}, [
  ["Diyafram Nefesi","Diaphragmatic Breathing","Diyafram","Diyafram"],
  ["Kutu Nefesi","Box Breathing (4-4-4-4)","Diyafram","Diyafram"],
  ["4-7-8 Nefes","4-7-8 Breathing","Diyafram","Diyafram"],
  ["Alternatif Burun Nefesi","Alternate Nostril Breathing","Diyafram","Diyafram"],
  ["Derin Karın Nefesi","Deep Belly Breathing","Diyafram","Diyafram"],
  ["Uzun Ekshalasyon","Extended Exhale Breathing","Diyafram","Diyafram"],
  ["Wim Hof Nefesi","Wim Hof Breathing","Diyafram","Diyafram"],
  ["Rahatlama Nefesi","Relaxation Breath","Diyafram","Diyafram"],
]);

// --------------------------------------------------------------------------- KALİSTENİK (ekstra)
group({
  movement_type: "Calisthenics", category: "compound", equipment: "bodyweight", environment: "both", is_home: true, is_gym: true,
  region: "front", secondary: ["Core"], stabilizers: ["Core"],
  goal: ["Vücut Ağırlığı Gücü","Kas Kontrolü","Dayanıklılık"], tempo: "kontrollü", rec_sets: 4, rec_reps: "6-12", rec_rest_sec: 90, calories: 6, duration: 150,
  desc: (n) => `${n} — vücut ağırlığı (kalistenik) hareketi. Ekipmansız güç ve kontrol geliştirir.`,
  instructions: ["Gövdeyi sıkı ve nötr tut.","Hareketi tam açıklıkta yap.","İniş fazını kontrol et.","Nefesi eforla senkronize et."],
  mistakes: ["Hareketi yarım yapmak","Salınım/momentum kullanmak","Core'u gevşetmek"],
  tips: ["Formu ilerledikçe zorlaştır","Negatif fazı yavaşlat","Kademeli olarak ilerlet"],
}, [
  ["Pike Şınav","Pike Push Up","Omuz","Omuz|Triceps"],
  ["Elmas Şınav","Diamond Push Up","Triceps","Triceps|Göğüs"],
  ["Archer Şınav","Archer Push Up","Göğüs","Göğüs|Triceps"],
  ["Hindu Şınav","Hindu Push Up","Omuz","Omuz|Göğüs"],
  ["Pseudo Planche Şınav","Pseudo Planche Push Up","Omuz","Omuz|Göğüs"],
  ["Geniş Tutuş Barfiks","Wide-Grip Pull Up","Sırt","Sırt|Biceps","back"],
  ["Dar Tutuş Barfiks","Close-Grip Chin Up","Sırt","Sırt|Biceps","back"],
  ["Komando Barfiks","Commando Pull Up","Sırt","Sırt|Biceps","back"],
  ["Avustralya Row","Australian Row","Sırt","Sırt|Biceps","back"],
  ["Muscle Up","Muscle Up","Sırt","Sırt|Göğüs|Triceps","back"],
  ["Dips (Paralel)","Parallel Bar Dips","Triceps","Triceps|Göğüs"],
  ["Kore Dips","Korean Dips","Triceps","Triceps|Sırt","back"],
  ["L-Sit","L-Sit","Karın","Karın|Kalça Fleksör"],
  ["Tuck Planche","Tuck Planche","Omuz","Omuz|Karın"],
  ["Tuck Front Lever","Tuck Front Lever","Sırt","Sırt|Karın","back"],
  ["Duvar Handstand","Wall Handstand Hold","Omuz","Omuz|Core"],
  ["Handstand Şınav (Duvar)","Wall Handstand Push Up","Omuz","Omuz|Triceps"],
  ["Pistol Squat","Pistol Squat","Bacak","Quadriceps|Kalça"],
  ["Shrimp Squat","Shrimp Squat","Bacak","Quadriceps|Kalça"],
  ["Nordic Curl","Nordic Hamstring Curl","Hamstring","Hamstring","back"],
  ["Sissy Squat","Sissy Squat","Quadriceps","Quadriceps"],
  ["Hollow Body Hold","Hollow Body Hold","Karın","Karın"],
  ["Superman Hold","Superman Hold","Sırt","Sırt|Kalça","back"],
  ["V-Up","V-Up","Karın","Karın"],
  ["Barfikste Bacak Kaldırma","Hanging Leg Raise","Karın","Karın|Kalça Fleksör"],
  ["Toes to Bar","Toes to Bar","Karın","Karın"],
  ["Cam Sileceği","Windshield Wipers","Karın","Obliqler|Karın"],
  ["İnsan Bayrağı Hazırlık","Human Flag Prep","Karın","Obliqler|Omuz"],
]);

// --------------------------------------------------------------------------- FONKSİYONEL / HIIT (ekstra)
group({
  movement_type: "Functional", category: "functional", equipment: "kettlebell", environment: "both", is_home: true, is_gym: true,
  region: "front", secondary: ["Core","Kalça"], stabilizers: ["Core"],
  goal: ["Fonksiyonel Güç","Kondisyon","Güç-Dayanıklılık"], tempo: "patlayıcı-kontrollü", rec_sets: 4, rec_reps: "10-15", rec_rest_sec: 60, calories: 8, duration: 150,
  desc: (n) => `${n} — fonksiyonel/kondisyon hareketi. Birden çok kas grubunu çalıştırır, güç ve dayanıklılığı birlikte geliştirir.`,
  instructions: ["Kalçadan güç üret, beli koru.","Core'u sabitleyerek başla.","Hareketi ritmik uygula.","Nefesi tempoyla eşle."],
  mistakes: ["Beli yuvarlamak","Kalça yerine belden çekmek","Kontrolsüz hız"],
  tips: ["Kalça menteşesini öğren","Ağırlığı kademeli artır","Formu hızdan önce koru"],
}, [
  ["Kettlebell Swing","Kettlebell Swing","Kalça","Kalça|Hamstring|Sırt","back"],
  ["Türk Kalkışı","Turkish Get Up","Tüm Vücut","Omuz|Core|Kalça"],
  ["Battle Ropes","Battle Ropes","Omuz","Omuz|Core|Kol"],
  ["Sled İtme","Sled Push","Bacak","Quadriceps|Kalça"],
  ["Farmer Carry","Farmer's Carry","Ön Kol","Ön Kol|Trapez|Core"],
  ["Wall Ball","Wall Ball Shot","Bacak","Quadriceps|Omuz"],
  ["Kutu Sıçraması","Box Jump","Bacak","Quadriceps|Kalça"],
  ["Thruster","Thruster","Bacak","Quadriceps|Omuz"],
  ["Devil Press","Devil Press","Tüm Vücut","Omuz|Kalça|Göğüs"],
  ["Man Maker","Man Maker","Tüm Vücut","Sırt|Göğüs|Omuz","back"],
  ["Dead Ball Slam","Dead Ball Slam","Sırt","Sırt|Core|Omuz","back"],
  ["Balyoz Vuruşu","Sledgehammer Swing","Core","Obliqler|Omuz"],
  ["Sled Çekişi","Sled Pull","Sırt","Sırt|Kalça","back"],
  ["Sandbag Clean","Sandbag Clean","Tüm Vücut","Kalça|Sırt","back"],
  ["Sandbag Taşıma","Sandbag Carry","Core","Core|Trapez"],
]);

// --------------------------------------------------------------------------- KARDİYO / HIIT (ekstra)
group({
  movement_type: "HIIT", category: "cardio", equipment: "bodyweight", environment: "both", is_home: true, is_gym: true,
  region: "front", secondary: ["Kalça"], stabilizers: ["Core"],
  goal: ["Kardiyo", "Yağ Yakımı", "Kondisyon"], tempo: "hızlı", rec_sets: 4, rec_reps: "30-45 sn", rec_rest_sec: 30, calories: 9, duration: 60,
  desc: (n) => `${n} — yüksek tempolu kardiyo/HIIT hareketi. Kalp atışını yükseltir, kalori yakımını artırır.`,
  instructions: ["Kısa ve yoğun aralıklarla çalış.","Formu bozmadan tempoyu koru.","Nefesini ritimli tut.","Aralar arasında kısa dinlen."],
  mistakes: ["Formu hız için bozmak","Nefesi tutmak","Isınmadan başlamak"],
  tips: ["Önce ısın","20-40 sn yüksek efor uygula","Aralıklarla süreyi artır"],
}, [
  ["İp Atlama","Jump Rope","Baldır","Baldır|Omuz"],
  ["Yüksek Diz Koşu","High Knees","Kalça","Kalça Fleksör|Baldır"],
  ["Topuk Vuruşu Koşu","Butt Kicks","Hamstring","Hamstring|Baldır","back"],
  ["Jumping Jack","Jumping Jack","Tüm Vücut","Omuz|Bacak"],
  ["Dağcı","Mountain Climber","Karın","Karın|Kalça Fleksör"],
  ["Skater Sıçrama","Skater Jumps","Bacak","Kalça|Quadriceps"],
  ["Squat Jump","Squat Jump","Bacak","Quadriceps|Kalça"],
  ["Tuck Jump","Tuck Jump","Bacak","Quadriceps|Karın"],
  ["Sprawl","Sprawl","Tüm Vücut","Göğüs|Core"],
  ["Lateral Bound","Lateral Bound","Bacak","Kalça|Quadriceps"],
  ["Star Jump","Star Jump","Tüm Vücut","Bacak|Omuz"],
  ["Fast Feet","Fast Feet","Baldır","Baldır|Kalça"],
  ["Plank Jack","Plank Jack","Karın","Karın|Omuz"],
  ["Broad Jump","Broad Jump","Bacak","Kalça|Quadriceps"],
]);

// --------------------------------------------------------------------------- SQL üret
const COLS = "(name, english_name, muscle_group, body_region, movement_type, category, difficulty, equipment, environment, is_home, is_gym, primary_muscles, secondary_muscles, stabilizer_muscles, exercise_goal, description, instructions, tempo, rec_sets, rec_reps, rec_rest_sec, common_mistakes, tips, media_type, calories, average_duration_sec)";
const val = (r) => `('${esc(r.name)}','${esc(r.english_name)}','${esc(r.muscle_group)}','${esc(r.body_region)}','${esc(r.movement_type)}','${esc(r.category)}','${esc(r.difficulty)}','${esc(r.equipment)}','${esc(r.environment)}',${r.is_home},${r.is_gym},${arr(r.primary_muscles)},${arr(r.secondary_muscles)},${arr(r.stabilizer_muscles)},${arr(r.exercise_goal)},'${esc(r.description)}',${arr(r.instructions)},'${esc(r.tempo)}',${r.rec_sets},'${esc(r.rec_reps)}',${r.rec_rest_sec},${arr(r.common_mistakes)},${arr(r.tips)},'${esc(r.media_type)}',${r.calories},${r.average_duration_sec})`;

let sql = `-- ============================================================================
-- VIVA — Wellness egzersiz kütüphanesi (Pilates, Yoga, Mobilite, Esneme,
-- Denge, Nefes, Kalistenik, Fonksiyonel, HIIT). ${rows.length} egzersiz.
-- Üretim: scripts/gen-exercises.mjs · Supabase SQL Editor → Run. Idempotent.
-- Not: category enum 'core' değerini kullanır (0009 sonrası mevcut).
-- ============================================================================
insert into public.exercises
  ${COLS}
values
${rows.map(val).join(",\n")}
on conflict (name) do nothing;
`;
writeFileSync(new URL("../supabase/seed/exercises_wellness.sql", import.meta.url), sql);
const byType = {};
for (const r of rows) byType[r.movement_type] = (byType[r.movement_type] || 0) + 1;
console.log(`OK — ${rows.length} egzersiz → supabase/seed/exercises_wellness.sql`);
console.log(byType);
