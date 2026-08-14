// ============================================================================
// Düzeltici egzersiz havuzu (Corrective Exercise Library).
// Her egzersizin EV ve SALON varyantı vardır; ortam seçimine göre çözülür.
// Postür problemleri bu havuzdaki anahtarlara (key) referans verir.
// Havuz genişletilebilir — 1000+ egzersiz aynı yapıyla eklenebilir.
// ============================================================================
import type {
  CorrectiveSectionType,
  Difficulty,
  ExerciseCategory,
  CorrectiveExercise,
} from "@/lib/database.types";

interface Variant {
  name: string;
  english: string;
  equipment: string;
}

export interface CorrectiveDef {
  section: CorrectiveSectionType;
  category: ExerciseCategory;
  difficulty: Difficulty;
  home: Variant;
  gym: Variant;
  description: string;
  sets: number | null;
  reps: string | null;
  rest_sec: number | null;
  duration_sec: number | null;
  breathing?: string;
  gif_url?: string;
}

// --- Egzersiz havuzu ---------------------------------------------------------
export const CORRECTIVE_POOL: Record<string, CorrectiveDef> = {
  // ---- MOBİLİZASYON ----
  thoracic_ext: {
    section: "mobilization",
    category: "mobility",
    difficulty: "beginner",
    home: { name: "Havlu ile Sırt Ekstansiyonu", english: "Foam Roller Thoracic Extension", equipment: "Havlu/Foam Roller" },
    gym: { name: "Foam Roller Sırt Ekstansiyonu", english: "Foam Roller Thoracic Extension", equipment: "Foam Roller" },
    description: "Üst sırtı foam roller/havlu üzerinde nazikçe gererek torakal omurganın esnekliğini artırır.",
    sets: 2, reps: "8-10", rest_sec: 30, duration_sec: null,
    breathing: "Geriye uzanırken nefes ver, geri gelirken al.",
  },
  thoracic_rotation: {
    section: "mobilization",
    category: "mobility",
    difficulty: "beginner",
    home: { name: "Açık Kitap Rotasyonu", english: "Open Book Thoracic Rotation", equipment: "Bodyweight" },
    gym: { name: "Açık Kitap Rotasyonu", english: "Open Book Thoracic Rotation", equipment: "Bodyweight" },
    description: "Yan yatıp üst gövdeyi açarak torakal rotasyon aralığını geliştirir.",
    sets: 2, reps: "her yön 8", rest_sec: 20, duration_sec: null,
    breathing: "Açılırken derin nefes al.",
  },
  cat_camel: {
    section: "mobilization",
    category: "mobility",
    difficulty: "beginner",
    home: { name: "Kedi-Deve", english: "Cat-Cow", equipment: "Bodyweight" },
    gym: { name: "Kedi-Deve", english: "Cat-Cow", equipment: "Mat" },
    description: "Omurgayı segment segment fleksiyon-ekstansiyona alarak bel-sırt mobilitesini artırır.",
    sets: 2, reps: "10", rest_sec: 20, duration_sec: null,
    breathing: "Çukurlaştırırken nefes al, kamburlaştırırken ver.",
  },
  hip_flexor_mob: {
    section: "mobilization",
    category: "mobility",
    difficulty: "beginner",
    home: { name: "Yarım Diz Kalça Fleksör Mobilizasyonu", english: "Half-Kneeling Hip Flexor Mobilization", equipment: "Bodyweight" },
    gym: { name: "Yarım Diz Kalça Fleksör Mobilizasyonu", english: "Half-Kneeling Hip Flexor Mobilization", equipment: "Mat" },
    description: "Kalça önünü açarak iliopsoas gerginliğini azaltır; anterior pelvik tilt için temel.",
    sets: 2, reps: "her taraf 8", rest_sec: 20, duration_sec: null,
  },
  ankle_mob: {
    section: "mobilization",
    category: "mobility",
    difficulty: "beginner",
    home: { name: "Duvara Diz Ayak Bileği Mobilizasyonu", english: "Knee-to-Wall Ankle Mobilization", equipment: "Bodyweight" },
    gym: { name: "Duvara Diz Ayak Bileği Mobilizasyonu", english: "Knee-to-Wall Ankle Mobilization", equipment: "Bodyweight" },
    description: "Dizi duvara doğru iterek dorsifleksiyon aralığını artırır; diz valgus ve pronasyon için kritik.",
    sets: 2, reps: "her taraf 10", rest_sec: 20, duration_sec: null,
  },
  neck_mob: {
    section: "mobilization",
    category: "mobility",
    difficulty: "beginner",
    home: { name: "Servikal CARs (Boyun Daireleri)", english: "Neck CARs Controlled Rotation", equipment: "Bodyweight" },
    gym: { name: "Servikal CARs (Boyun Daireleri)", english: "Neck CARs Controlled Rotation", equipment: "Bodyweight" },
    description: "Boynu kontrollü ve yavaş çevirerek servikal eklem aralığını korur.",
    sets: 1, reps: "her yön 5", rest_sec: 20, duration_sec: null,
  },
  shoulder_cars: {
    section: "mobilization",
    category: "mobility",
    difficulty: "beginner",
    home: { name: "Omuz CARs", english: "Shoulder CARs Controlled Rotation", equipment: "Bodyweight" },
    gym: { name: "Omuz CARs", english: "Shoulder CARs Controlled Rotation", equipment: "Bodyweight" },
    description: "Omuz ekleminin tüm hareket açıklığını kontrollü şekilde tarar.",
    sets: 1, reps: "her kol 5", rest_sec: 20, duration_sec: null,
  },

  // ---- AKTİVASYON ----
  deep_neck_flexor: {
    section: "activation",
    category: "activation",
    difficulty: "beginner",
    home: { name: "Çene İçeri Çekme (Chin Tuck)", english: "Chin Tuck Deep Neck Flexor", equipment: "Bodyweight" },
    gym: { name: "Çene İçeri Çekme (Chin Tuck)", english: "Chin Tuck Deep Neck Flexor", equipment: "Bodyweight" },
    description: "Derin boyun fleksörlerini aktive ederek başı omuz hizasına getirir; forward head için temel.",
    sets: 2, reps: "10 (3 sn tut)", rest_sec: 20, duration_sec: null,
  },
  scapular_retraction: {
    section: "activation",
    category: "activation",
    difficulty: "beginner",
    home: { name: "Band Pull Apart", english: "Band Pull Apart", equipment: "Resistance Band" },
    gym: { name: "Cable Face Pull", english: "Cable Face Pull", equipment: "Cable" },
    description: "Skapula retraksiyonunu ve orta trapezi aktive eder; yuvarlak omuz için anahtar hareket.",
    sets: 3, reps: "15", rest_sec: 40, duration_sec: null,
  },
  lower_trap: {
    section: "activation",
    category: "activation",
    difficulty: "beginner",
    home: { name: "Yüzüstü Y Kaldırış", english: "Prone Y Raise", equipment: "Bodyweight" },
    gym: { name: "Eğik Bench Y Raise", english: "Incline Bench Y Raise", equipment: "Dumbbell" },
    description: "Alt trapezi hedefleyerek skapula depresyonunu güçlendirir.",
    sets: 3, reps: "12", rest_sec: 40, duration_sec: null,
  },
  glute_bridge: {
    section: "activation",
    category: "activation",
    difficulty: "beginner",
    home: { name: "Glute Bridge", english: "Glute Bridge", equipment: "Bodyweight" },
    gym: { name: "Glute Bridge", english: "Glute Bridge", equipment: "Mat" },
    description: "Gluteal kasları aktive ederek pelvik stabiliteyi artırır; lower cross için kritik.",
    sets: 3, reps: "12 (2 sn tut)", rest_sec: 40, duration_sec: null,
  },
  clamshell: {
    section: "activation",
    category: "activation",
    difficulty: "beginner",
    home: { name: "Clamshell (Band)", english: "Banded Clamshell", equipment: "Resistance Band" },
    gym: { name: "Makine Kalça Abdüksiyon", english: "Hip Abduction Machine", equipment: "Machine" },
    description: "Gluteus medius'u izole eder; diz valgus ve kalça asimetrisinde denge sağlar.",
    sets: 3, reps: "her taraf 15", rest_sec: 30, duration_sec: null,
  },
  serratus: {
    section: "activation",
    category: "activation",
    difficulty: "beginner",
    home: { name: "Duvar Slide + Serratus İtiş", english: "Wall Slide Serratus Punch", equipment: "Bodyweight" },
    gym: { name: "Kablolu Serratus İtiş", english: "Cable Serratus Punch", equipment: "Cable" },
    description: "Serratus anterior'u aktive ederek skapula protraksiyon-stabilizasyonunu geliştirir.",
    sets: 3, reps: "12", rest_sec: 30, duration_sec: null,
  },
  core_deadbug: {
    section: "activation",
    category: "core",
    difficulty: "beginner",
    home: { name: "Dead Bug", english: "Dead Bug", equipment: "Bodyweight" },
    gym: { name: "Dead Bug", english: "Dead Bug", equipment: "Mat" },
    description: "Derin kor kaslarını aktive ederken lomber omurgayı nötr tutmayı öğretir.",
    sets: 3, reps: "her taraf 8", rest_sec: 30, duration_sec: null,
    breathing: "Kolu-bacağı uzatırken yavaş nefes ver.",
  },
  vmo: {
    section: "activation",
    category: "activation",
    difficulty: "beginner",
    home: { name: "Terminal Diz Ekstansiyonu (Band)", english: "Banded Terminal Knee Extension", equipment: "Resistance Band" },
    gym: { name: "Kablolu Terminal Diz Ekstansiyonu", english: "Cable Terminal Knee Extension", equipment: "Cable" },
    description: "VMO (iç uyluk) kasını hedefleyerek diz kapağı hizasını iyileştirir.",
    sets: 3, reps: "15", rest_sec: 30, duration_sec: null,
  },
  monster_walk: {
    section: "activation",
    category: "activation",
    difficulty: "beginner",
    home: { name: "Band Monster Walk", english: "Banded Monster Walk", equipment: "Resistance Band" },
    gym: { name: "Band Monster Walk", english: "Banded Monster Walk", equipment: "Resistance Band" },
    description: "Kalça abdüktörlerini yürüyüş paterni içinde çalıştırır; diz valgus kontrolü.",
    sets: 3, reps: "10 adım x2", rest_sec: 30, duration_sec: null,
  },
  bird_dog: {
    section: "activation",
    category: "core",
    difficulty: "beginner",
    home: { name: "Bird Dog", english: "Bird Dog", equipment: "Bodyweight" },
    gym: { name: "Bird Dog", english: "Bird Dog", equipment: "Mat" },
    description: "Karşıt kol-bacak uzatımıyla kor ve omurga stabilizasyonunu geliştirir.",
    sets: 3, reps: "her taraf 8", rest_sec: 30, duration_sec: null,
  },

  // ---- GÜÇLENDİRME ----
  face_pull: {
    section: "strengthening",
    category: "isolation",
    difficulty: "beginner",
    home: { name: "Band Face Pull", english: "Band Face Pull", equipment: "Resistance Band" },
    gym: { name: "Cable Face Pull", english: "Cable Face Pull", equipment: "Cable" },
    description: "Arka omuz ve dış rotatorları güçlendirir; yuvarlak omuzun en etkili düzelticisi.",
    sets: 3, reps: "15", rest_sec: 45, duration_sec: null,
  },
  row: {
    section: "strengthening",
    category: "compound",
    difficulty: "beginner",
    home: { name: "Dumbbell Row", english: "Single-Arm Dumbbell Row", equipment: "Dumbbell" },
    gym: { name: "Oturarak Cable Row", english: "Seated Cable Row", equipment: "Cable" },
    description: "Sırt orta bölgesini güçlendirerek dik duruşu destekler.",
    sets: 3, reps: "12", rest_sec: 60, duration_sec: null,
  },
  reverse_fly: {
    section: "strengthening",
    category: "isolation",
    difficulty: "beginner",
    home: { name: "Dumbbell Reverse Fly", english: "Bent-Over Dumbbell Reverse Fly", equipment: "Dumbbell" },
    gym: { name: "Reverse Pec Deck", english: "Reverse Pec Deck", equipment: "Machine" },
    description: "Arka deltoid ve romboidleri izole ederek omuzları geriye çeker.",
    sets: 3, reps: "15", rest_sec: 45, duration_sec: null,
  },
  ytw: {
    section: "strengthening",
    category: "isolation",
    difficulty: "beginner",
    home: { name: "YTW Kaldırış", english: "YTW Raises", equipment: "Dumbbell" },
    gym: { name: "Eğik Bench YTW", english: "Incline Bench YTW Raises", equipment: "Dumbbell" },
    description: "Trapezin üç bölgesini ve romboidleri hedefleyen skapula kompleks çalışması.",
    sets: 2, reps: "her harf 10", rest_sec: 45, duration_sec: null,
  },
  wall_angel: {
    section: "strengthening",
    category: "mobility",
    difficulty: "beginner",
    home: { name: "Duvar Meleği (Wall Angel)", english: "Wall Angel", equipment: "Bodyweight" },
    gym: { name: "Duvar Meleği (Wall Angel)", english: "Wall Angel", equipment: "Bodyweight" },
    description: "Sırtı duvara yaslayıp kolları kaydırarak skapula ritmi ve omuz postürünü düzeltir.",
    sets: 3, reps: "10", rest_sec: 40, duration_sec: null,
  },
  hip_thrust: {
    section: "strengthening",
    category: "compound",
    difficulty: "intermediate",
    home: { name: "Tek Bacak Hip Thrust", english: "Single-Leg Hip Thrust", equipment: "Bodyweight" },
    gym: { name: "Barbell Hip Thrust", english: "Barbell Hip Thrust", equipment: "Barbell" },
    description: "Gluteal gücü maksimize ederek pelvik tilt ve lower cross sendromunu düzeltir.",
    sets: 3, reps: "12", rest_sec: 60, duration_sec: null,
  },
  rdl: {
    section: "strengthening",
    category: "compound",
    difficulty: "intermediate",
    home: { name: "Dumbbell Romanian Deadlift", english: "Dumbbell Romanian Deadlift", equipment: "Dumbbell" },
    gym: { name: "Barbell Romanian Deadlift", english: "Barbell Romanian Deadlift", equipment: "Barbell" },
    description: "Arka zincir (hamstring-glute) gücünü artırarak pelvis dengesini iyileştirir.",
    sets: 3, reps: "10", rest_sec: 75, duration_sec: null,
  },
  plank: {
    section: "strengthening",
    category: "core",
    difficulty: "beginner",
    home: { name: "Plank", english: "Front Plank", equipment: "Bodyweight" },
    gym: { name: "Plank", english: "Front Plank", equipment: "Mat" },
    description: "Ön kor duvarını izometrik güçlendirir; lomber stabiliteyi artırır.",
    sets: 3, reps: null, rest_sec: 40, duration_sec: 40,
    breathing: "Sabit ve kontrollü nefes al-ver.",
  },
  side_plank: {
    section: "strengthening",
    category: "core",
    difficulty: "intermediate",
    home: { name: "Yan Plank", english: "Side Plank", equipment: "Bodyweight" },
    gym: { name: "Yan Plank", english: "Side Plank", equipment: "Mat" },
    description: "Lateral kor ve quadratus lumborum'u çalıştırarak omurga asimetrisini dengeler.",
    sets: 3, reps: "her taraf", rest_sec: 40, duration_sec: 30,
  },
  pallof: {
    section: "strengthening",
    category: "core",
    difficulty: "beginner",
    home: { name: "Band Pallof Press", english: "Banded Pallof Press", equipment: "Resistance Band" },
    gym: { name: "Cable Pallof Press", english: "Cable Pallof Press", equipment: "Cable" },
    description: "Anti-rotasyon kor çalışmasıyla omurgayı nötr tutmayı güçlendirir.",
    sets: 3, reps: "her taraf 12", rest_sec: 40, duration_sec: null,
  },
  single_leg_balance: {
    section: "strengthening",
    category: "balance",
    difficulty: "beginner",
    home: { name: "Tek Ayak Denge", english: "Single-Leg Balance", equipment: "Bodyweight" },
    gym: { name: "Bosu Tek Ayak Denge", english: "Bosu Single-Leg Balance", equipment: "Bosu" },
    description: "Ayak bileği-diz-kalça hattının nöromusküler kontrolünü geliştirir.",
    sets: 3, reps: "her taraf", rest_sec: 30, duration_sec: 30,
  },
  calf_raise: {
    section: "strengthening",
    category: "isolation",
    difficulty: "beginner",
    home: { name: "Ayakta Calf Raise", english: "Standing Calf Raise", equipment: "Bodyweight" },
    gym: { name: "Makine Calf Raise", english: "Machine Calf Raise", equipment: "Machine" },
    description: "Baldır ve tibialis posterior desteğiyle ayak arkını ve pronasyonu düzeltir.",
    sets: 3, reps: "15", rest_sec: 40, duration_sec: null,
  },

  // ---- ESNEME ----
  pec_stretch: {
    section: "stretching",
    category: "stretch",
    difficulty: "beginner",
    home: { name: "Kapı Kenarı Göğüs Esnetme", english: "Doorway Pec Stretch", equipment: "Bodyweight" },
    gym: { name: "Kapı/Rack Göğüs Esnetme", english: "Doorway Pec Stretch", equipment: "Rack" },
    description: "Kısalan göğüs kaslarını (pectoralis) açarak omuzların öne dönmesini azaltır.",
    sets: 2, reps: null, rest_sec: 15, duration_sec: 30,
  },
  upper_trap_stretch: {
    section: "stretching",
    category: "stretch",
    difficulty: "beginner",
    home: { name: "Üst Trapez Esnetme", english: "Upper Trapezius Stretch", equipment: "Bodyweight" },
    gym: { name: "Üst Trapez Esnetme", english: "Upper Trapezius Stretch", equipment: "Bodyweight" },
    description: "Gergin üst trapezi uzatarak boyun-omuz gerginliğini azaltır.",
    sets: 2, reps: "her taraf", rest_sec: 15, duration_sec: 30,
  },
  levator_stretch: {
    section: "stretching",
    category: "stretch",
    difficulty: "beginner",
    home: { name: "Levator Skapula Esnetme", english: "Levator Scapulae Stretch", equipment: "Bodyweight" },
    gym: { name: "Levator Skapula Esnetme", english: "Levator Scapulae Stretch", equipment: "Bodyweight" },
    description: "Boynun arka-yan bölgesindeki levator scapulae gerginliğini giderir.",
    sets: 2, reps: "her taraf", rest_sec: 15, duration_sec: 30,
  },
  lat_stretch: {
    section: "stretching",
    category: "stretch",
    difficulty: "beginner",
    home: { name: "Lat Esnetme", english: "Lat Stretch", equipment: "Bodyweight" },
    gym: { name: "Rack Lat Esnetme", english: "Overhead Lat Stretch", equipment: "Rack" },
    description: "Latissimus dorsi'yi uzatarak omuz elevasyonu ve dik duruşu kolaylaştırır.",
    sets: 2, reps: "her taraf", rest_sec: 15, duration_sec: 30,
  },
  hip_flexor_stretch: {
    section: "stretching",
    category: "stretch",
    difficulty: "beginner",
    home: { name: "Diz Üstü Kalça Fleksör Esnetme", english: "Kneeling Hip Flexor Stretch", equipment: "Bodyweight" },
    gym: { name: "Diz Üstü Kalça Fleksör Esnetme", english: "Kneeling Hip Flexor Stretch", equipment: "Mat" },
    description: "İliopsoas'ı uzatarak anterior pelvik tilt ve lordozu azaltır.",
    sets: 2, reps: "her taraf", rest_sec: 15, duration_sec: 30,
  },
  ql_stretch: {
    section: "stretching",
    category: "stretch",
    difficulty: "beginner",
    home: { name: "Quadratus Lumborum Esnetme", english: "Quadratus Lumborum Side Stretch", equipment: "Bodyweight" },
    gym: { name: "Quadratus Lumborum Esnetme", english: "Quadratus Lumborum Side Stretch", equipment: "Bodyweight" },
    description: "Belin yan bölgesindeki QL kasını uzatır; asimetri ve lomber gerginlikte etkili.",
    sets: 2, reps: "her taraf", rest_sec: 15, duration_sec: 30,
  },
  calf_stretch: {
    section: "stretching",
    category: "stretch",
    difficulty: "beginner",
    home: { name: "Duvara Baldır Esnetme", english: "Wall Calf Stretch", equipment: "Bodyweight" },
    gym: { name: "Duvara Baldır Esnetme", english: "Wall Calf Stretch", equipment: "Bodyweight" },
    description: "Gastroknemius-soleus'u uzatarak ayak bileği dorsifleksiyonunu artırır.",
    sets: 2, reps: "her taraf", rest_sec: 15, duration_sec: 30,
  },

  // ---- SOĞUMA ----
  diaphragmatic_breathing: {
    section: "cooldown",
    category: "cooldown",
    difficulty: "beginner",
    home: { name: "Diyafram Nefesi", english: "Diaphragmatic Breathing", equipment: "Bodyweight" },
    gym: { name: "Diyafram Nefesi", english: "Diaphragmatic Breathing", equipment: "Mat" },
    description: "Karın nefesiyle parasempatik sistemi aktive eder; kor-postür bağlantısını sıfırlar.",
    sets: 1, reps: null, rest_sec: 0, duration_sec: 120,
    breathing: "4 sn al, 6 sn ver; göğüs değil karın şişsin.",
  },
  child_pose: {
    section: "cooldown",
    category: "cooldown",
    difficulty: "beginner",
    home: { name: "Çocuk Pozu", english: "Child's Pose", equipment: "Bodyweight" },
    gym: { name: "Çocuk Pozu", english: "Child's Pose", equipment: "Mat" },
    description: "Sırt ve kalçayı nazikçe uzatarak toparlanmayı hızlandırır.",
    sets: 1, reps: null, rest_sec: 0, duration_sec: 60,
  },
  supine_twist: {
    section: "cooldown",
    category: "cooldown",
    difficulty: "beginner",
    home: { name: "Sırtüstü Omurga Rotasyonu", english: "Supine Spinal Twist", equipment: "Bodyweight" },
    gym: { name: "Sırtüstü Omurga Rotasyonu", english: "Supine Spinal Twist", equipment: "Mat" },
    description: "Lomber ve torakal bölgeyi nazik rotasyonla gevşetir.",
    sets: 1, reps: "her taraf", rest_sec: 0, duration_sec: 45,
  },
  neck_release: {
    section: "cooldown",
    category: "cooldown",
    difficulty: "beginner",
    home: { name: "Boyun Gevşetme", english: "Neck Release Relaxation", equipment: "Bodyweight" },
    gym: { name: "Boyun Gevşetme", english: "Neck Release Relaxation", equipment: "Bodyweight" },
    description: "Boyun çevresi kasları nazik hareketlerle gevşetir.",
    sets: 1, reps: null, rest_sec: 0, duration_sec: 45,
  },
};

/** Bir egzersiz anahtarını ortama göre çözüp UI için hazır nesne döndürür. */
export function resolveExercise(
  key: string,
  env: "home" | "gym"
): CorrectiveExercise | null {
  const def = CORRECTIVE_POOL[key];
  if (!def) return null;
  const v = def[env];
  return {
    key,
    name: v.name,
    english_name: v.english,
    section: def.section,
    equipment: v.equipment,
    category: def.category,
    difficulty: def.difficulty,
    description: def.description,
    sets: def.sets,
    reps: def.reps,
    rest_sec: def.rest_sec,
    duration_sec: def.duration_sec,
    breathing: def.breathing ?? null,
    gif_url: def.gif_url ?? null,
  };
}
