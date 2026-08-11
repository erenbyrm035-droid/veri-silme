// ============================================================================
// Postür problemleri bilgi tabanı.
// Her problem: etkilenen/zayıf/gergin kaslar, AI açıklamaları, düzeltici
// egzersiz eşlemesi (havuz anahtarları) ve öz-değerlendirme sorusu içerir.
// ============================================================================
import type {
  PostureProblem,
  PostureView,
  RiskLevel,
  CorrectiveSectionType,
} from "@/lib/database.types";

export interface ProblemInfo {
  label: string;
  english: string;
  view: PostureView; // hangi fotoğraf açısından değerlendirilir
  defaultRisk: RiskLevel;
  affected_muscles: string[];
  weak_muscles: string[];
  tight_muscles: string[];
  description: string;
  explanation: {
    meaning: string;
    daily_life: string;
    sport_performance: string;
    recovery_time: string;
    cautions: string;
  };
  /** Öz-değerlendirme sorusu (AI görüntü analizi yoksa kullanılır). */
  assessment: string;
  /** Düzeltici egzersiz havuzu anahtarları (bölüm bazında). */
  corrective: Record<CorrectiveSectionType, string[]>;
}

export const POSTURE_PROBLEMS: Record<PostureProblem, ProblemInfo> = {
  forward_head: {
    label: "Öne Baş Duruşu",
    english: "Forward Head Posture",
    view: "side",
    defaultRisk: "moderate",
    affected_muscles: ["Servikal omurga", "Üst sırt"],
    weak_muscles: ["Derin boyun fleksörleri", "Alt trapez", "Serratus anterior"],
    tight_muscles: ["Suboksipitaller", "Üst trapez", "Levator skapula", "SCM"],
    description:
      "Baş, omuz hattının önüne kayar. Her 2-3 cm öne kayışta boyun üzerindeki yük belirgin şekilde artar.",
    explanation: {
      meaning:
        "Başın kulak-omuz hattının önünde konumlanmasıdır. Genellikle uzun ekran/telefon kullanımıyla ilişkilidir.",
      daily_life:
        "Boyun ve üst sırt ağrısı, baş ağrısı ve çabuk yorulmaya yol açabilir; nefes kapasitesini hafifçe düşürebilir.",
      sport_performance:
        "Omuz üstü hareketlerde (pres, çekiş) sıkışma riskini artırır ve üst vücut kuvvet aktarımını azaltır.",
      recovery_time: "Tutarlı çalışmayla genellikle 6-12 hafta.",
      cautions:
        "Keskin, yayılan ağrı veya uyuşma varsa egzersizi durdur ve sağlık profesyoneline danışın.",
    },
    assessment: "Yandan bakıldığında başın omuzların belirgin şekilde önünde mi?",
    corrective: {
      mobilization: ["thoracic_ext", "neck_mob"],
      activation: ["deep_neck_flexor", "scapular_retraction"],
      strengthening: ["face_pull", "wall_angel"],
      stretching: ["upper_trap_stretch", "levator_stretch", "pec_stretch"],
      cooldown: ["diaphragmatic_breathing", "neck_release"],
    },
  },

  rounded_shoulders: {
    label: "Yuvarlak Omuz",
    english: "Rounded Shoulders",
    view: "side",
    defaultRisk: "moderate",
    affected_muscles: ["Omuz kuşağı", "Üst sırt"],
    weak_muscles: ["Orta/Alt trapez", "Romboidler", "Dış rotatorlar", "Serratus anterior"],
    tight_muscles: ["Pectoralis major/minor", "Latissimus dorsi", "Üst trapez"],
    description:
      "Omuzlar öne ve içe döner, üst sırt hafifçe yuvarlaklaşır. Masa başı çalışanlarda çok yaygındır.",
    explanation: {
      meaning:
        "Omuz eklemlerinin öne-içe rotasyona girmesidir; göğüs kasları kısalır, sırt kasları zayıflar.",
      daily_life:
        "Omuz-boyun gerginliği, dik durmakta zorlanma ve nefes derinliğinde azalma görülebilir.",
      sport_performance:
        "Bench press, omuz pres ve çekiş hareketlerinde omuz sıkışması ve güç kaybı yaratabilir.",
      recovery_time: "Düzenli çalışmayla 6-10 hafta.",
      cautions:
        "Omuzda takılma/ağrı hissi olursa hareket açıklığını azalt; ağrı sürerse uzmana danışın.",
    },
    assessment: "Ayakta rahat dururken ellerin sırtı öne mi bakıyor (omuzlar içe dönük)?",
    corrective: {
      mobilization: ["thoracic_ext", "thoracic_rotation", "shoulder_cars"],
      activation: ["scapular_retraction", "lower_trap", "serratus"],
      strengthening: ["face_pull", "reverse_fly", "row", "ytw"],
      stretching: ["pec_stretch", "lat_stretch"],
      cooldown: ["diaphragmatic_breathing", "child_pose"],
    },
  },

  upper_cross: {
    label: "Üst Çapraz Sendrom",
    english: "Upper Cross Syndrome",
    view: "side",
    defaultRisk: "high",
    affected_muscles: ["Boyun", "Omuz kuşağı", "Üst sırt"],
    weak_muscles: ["Derin boyun fleksörleri", "Alt/Orta trapez", "Serratus anterior"],
    tight_muscles: ["Üst trapez", "Levator skapula", "Pectoralis major/minor"],
    description:
      "Öne baş + yuvarlak omuzun birlikte görüldüğü klasik kas dengesizliği paternidir.",
    explanation: {
      meaning:
        "Gergin (üst trapez/göğüs) ve zayıf (derin boyun/alt trapez) kaslar çapraz bir desen oluşturur.",
      daily_life:
        "Kronik boyun-omuz ağrısı, baş ağrısı ve dik durmakta belirgin zorluk yaratabilir.",
      sport_performance:
        "Üst vücut itiş-çekiş dengesini bozar; omuz yaralanma riskini artırır.",
      recovery_time: "Genellikle 8-12 hafta düzenli çalışma.",
      cautions:
        "Kombine bir patern olduğu için ilerlemeyi yavaş tut; ağrıda uzmana danışın.",
    },
    assessment: "Hem başın önde hem omuzların içe dönük olduğunu düşünüyor musun?",
    corrective: {
      mobilization: ["thoracic_ext", "thoracic_rotation", "neck_mob"],
      activation: ["deep_neck_flexor", "lower_trap", "serratus"],
      strengthening: ["face_pull", "row", "reverse_fly", "wall_angel"],
      stretching: ["pec_stretch", "upper_trap_stretch", "levator_stretch"],
      cooldown: ["diaphragmatic_breathing", "child_pose"],
    },
  },

  lower_cross: {
    label: "Alt Çapraz Sendrom",
    english: "Lower Cross Syndrome",
    view: "side",
    defaultRisk: "high",
    affected_muscles: ["Bel", "Pelvis", "Kalça"],
    weak_muscles: ["Gluteus maximus", "Derin kor (transversus abdominis)"],
    tight_muscles: ["Kalça fleksörleri (iliopsoas)", "Lomber erektörler"],
    description:
      "Pelvisin öne eğilmesiyle belde artmış çukurluk ve zayıf kalça-kor dengesi görülür.",
    explanation: {
      meaning:
        "Gergin kalça fleksörleri/bel ile zayıf glute/kor kaslarının oluşturduğu çapraz dengesizliktir.",
      daily_life:
        "Bel ağrısı, uzun oturmada rahatsızlık ve göbek bölgesinin öne çıkması görülebilir.",
      sport_performance:
        "Squat/deadlift gibi hareketlerde bel yükünü artırır, güç aktarımını azaltır.",
      recovery_time: "8-12 hafta düzenli çalışma.",
      cautions:
        "Bel ağrısı keskinse veya bacağa yayılıyorsa dur ve sağlık profesyoneline danışın.",
    },
    assessment: "Yandan bakınca belinde belirgin bir çukur/göbek öne çıkışı var mı?",
    corrective: {
      mobilization: ["cat_camel", "hip_flexor_mob"],
      activation: ["glute_bridge", "core_deadbug", "bird_dog"],
      strengthening: ["hip_thrust", "plank", "pallof"],
      stretching: ["hip_flexor_stretch", "ql_stretch"],
      cooldown: ["diaphragmatic_breathing", "supine_twist"],
    },
  },

  kyphosis: {
    label: "Kifoz (Kamburluk)",
    english: "Kyphosis",
    view: "side",
    defaultRisk: "moderate",
    affected_muscles: ["Torakal omurga", "Üst sırt"],
    weak_muscles: ["Torakal erektörler", "Orta/Alt trapez", "Romboidler"],
    tight_muscles: ["Pectoralis", "Karın ön duvarı (üst)", "Latissimus dorsi"],
    description:
      "Üst sırtın ileri derecede yuvarlaklaşmasıdır; ‘kambur’ görünümü verir.",
    explanation: {
      meaning:
        "Torakal omurganın normalden fazla öne kavis yapmasıdır. Postürel veya yapısal olabilir.",
      daily_life:
        "Sırt yorgunluğu, dik durmakta zorluk ve göğüs açıklığında azalma görülebilir.",
      sport_performance:
        "Omuz üstü hareketlerde açı kaybı ve nefes kapasitesinde düşüş yaratabilir.",
      recovery_time:
        "Postürel tipte 8-12 hafta; yapısal tipte tıbbi değerlendirme gerekir.",
      cautions:
        "Ani artan kamburluk veya ağrı varsa mutlaka bir sağlık profesyoneline görün.",
    },
    assessment: "Yandan bakıldığında üst sırtın belirgin şekilde yuvarlak/kambur mu?",
    corrective: {
      mobilization: ["thoracic_ext", "thoracic_rotation", "cat_camel"],
      activation: ["lower_trap", "serratus", "scapular_retraction"],
      strengthening: ["face_pull", "row", "reverse_fly", "ytw", "wall_angel"],
      stretching: ["pec_stretch", "lat_stretch"],
      cooldown: ["child_pose", "diaphragmatic_breathing"],
    },
  },

  lordosis: {
    label: "Lordoz (Bel Çukuru Artışı)",
    english: "Lordosis",
    view: "side",
    defaultRisk: "moderate",
    affected_muscles: ["Lomber omurga", "Pelvis"],
    weak_muscles: ["Karın kasları", "Gluteus maximus", "Hamstring"],
    tight_muscles: ["Lomber erektörler", "Kalça fleksörleri"],
    description:
      "Bel bölgesindeki iç kavisin normalden fazla olmasıdır; sıklıkla pelvik tilt ile birliktedir.",
    explanation: {
      meaning:
        "Lomber omurganın aşırı iç kavis yapmasıdır. Kor-glute zayıflığı ile ilişkilidir.",
      daily_life:
        "Ayakta uzun kalınca bel ağrısı ve yorgunluk hissi verebilir.",
      sport_performance:
        "Bel üzerindeki kompresyonu artırır; ağır kaldırışlarda risk oluşturur.",
      recovery_time: "8-12 hafta düzenli kor-glute çalışması.",
      cautions:
        "Bel ağrısı bacağa yayılıyorsa veya uyuşma varsa uzmana danışın.",
    },
    assessment: "Ayakta dururken belinde aşırı bir iç çukur olduğunu hissediyor musun?",
    corrective: {
      mobilization: ["cat_camel", "hip_flexor_mob"],
      activation: ["glute_bridge", "core_deadbug", "pallof"],
      strengthening: ["hip_thrust", "plank", "rdl"],
      stretching: ["hip_flexor_stretch", "ql_stretch"],
      cooldown: ["diaphragmatic_breathing", "supine_twist"],
    },
  },

  scoliosis: {
    label: "Skolyoz (Ön Değerlendirme)",
    english: "Scoliosis (Screening)",
    view: "back",
    defaultRisk: "high",
    affected_muscles: ["Omurga (lateral)", "Sırt", "Bel"],
    weak_muscles: ["Konveks taraf kor kasları", "Omurga stabilizatörleri"],
    tight_muscles: ["Konkav taraf QL ve erektörler"],
    description:
      "Omurganın yana doğru eğrilik göstermesidir. Bu yalnızca bir ön tarama; tanı görüntüleme gerektirir.",
    explanation: {
      meaning:
        "Omurganın ‘S’ veya ‘C’ şeklinde yana eğrilmesidir. Derecesi röntgen ile belirlenir.",
      daily_life:
        "Omuz/kalça seviyesinde asimetri, tek tarafta yorgunluk hissi olabilir.",
      sport_performance:
        "Yük dağılımını dengesizleştirebilir; simetrik çalışmayı zorlaştırır.",
      recovery_time:
        "Egzersiz semptomu yönetir; yapısal düzelme için tıbbi takip şarttır.",
      cautions:
        "Bu bir tanı değildir. Şüphe varsa mutlaka ortopedi/fizyoterapi değerlendirmesi alın.",
    },
    assessment: "Arkadan bakıldığında omurga hattın yana doğru eğri gibi mi görünüyor?",
    corrective: {
      mobilization: ["thoracic_rotation", "cat_camel"],
      activation: ["core_deadbug", "bird_dog", "side_plank"],
      strengthening: ["side_plank", "pallof"],
      stretching: ["ql_stretch", "lat_stretch"],
      cooldown: ["diaphragmatic_breathing"],
    },
  },

  pelvic_tilt: {
    label: "Pelvik Tilt (Öne Eğim)",
    english: "Anterior Pelvic Tilt",
    view: "side",
    defaultRisk: "moderate",
    affected_muscles: ["Pelvis", "Bel", "Kalça"],
    weak_muscles: ["Gluteus maximus", "Karın kasları", "Hamstring"],
    tight_muscles: ["Kalça fleksörleri", "Lomber erektörler"],
    description:
      "Pelvisin öne doğru dönmesidir; belde çukurluğu ve göbeğin öne çıkışını belirginleştirir.",
    explanation: {
      meaning:
        "Leğen kemiğinin öne eğilmesidir. Glute/kor zayıflığı ve kalça fleksör kısalığıyla ilişkilidir.",
      daily_life:
        "Bel yorgunluğu ve postür bozukluğu hissi; uzun oturmada belirginleşir.",
      sport_performance:
        "Kalça menzilini ve glute aktivasyonunu düşürür; squat/koşu verimini azaltır.",
      recovery_time: "6-10 hafta düzenli çalışma.",
      cautions:
        "Bel ağrısı kalıcıysa hareket açıklığını azalt ve uzmana danışın.",
    },
    assessment: "Leğen kemiğin öne eğik, kalça hafif geride mi duruyor?",
    corrective: {
      mobilization: ["hip_flexor_mob", "cat_camel"],
      activation: ["glute_bridge", "core_deadbug"],
      strengthening: ["hip_thrust", "plank", "rdl"],
      stretching: ["hip_flexor_stretch"],
      cooldown: ["diaphragmatic_breathing", "supine_twist"],
    },
  },

  knee_valgus: {
    label: "Diz İçe Basma (Valgus)",
    english: "Knee Valgus",
    view: "front",
    defaultRisk: "high",
    affected_muscles: ["Diz", "Kalça", "Ayak bileği"],
    weak_muscles: ["Gluteus medius", "VMO (iç uyluk)", "Kalça dış rotatorları"],
    tight_muscles: ["Adduktorlar", "TFL / IT bandı", "Baldırlar"],
    description:
      "Çömelme veya adımda dizlerin içe doğru düşmesidir; diz yaralanma riskini artırır.",
    explanation: {
      meaning:
        "Diz ekleminin içe kollabe olmasıdır. Kalça abdüktör zayıflığıyla yakından ilişkilidir.",
      daily_life:
        "Merdiven inip çıkarken diz önü rahatsızlığı olabilir.",
      sport_performance:
        "Sıçrama-iniş ve çömelmede ACL/menisküs riskini ciddi ölçüde artırır.",
      recovery_time: "6-10 hafta kalça-diz nöromusküler çalışması.",
      cautions:
        "Dizde ağrı, şişme veya boşalma hissi varsa egzersizi durdur ve uzmana danışın.",
    },
    assessment: "Çömeldiğinde dizlerin içe doğru mu kayıyor?",
    corrective: {
      mobilization: ["ankle_mob", "hip_flexor_mob"],
      activation: ["clamshell", "glute_bridge", "monster_walk"],
      strengthening: ["hip_thrust", "single_leg_balance", "vmo"],
      stretching: ["hip_flexor_stretch", "calf_stretch"],
      cooldown: ["diaphragmatic_breathing"],
    },
  },

  foot_pronation: {
    label: "Ayak İçe Basma (Pronasyon)",
    english: "Foot Pronation",
    view: "front",
    defaultRisk: "moderate",
    affected_muscles: ["Ayak", "Ayak bileği", "Diz"],
    weak_muscles: ["Tibialis posterior", "Ayak içi kasları", "Gluteus medius"],
    tight_muscles: ["Baldırlar (gastroknemius/soleus)", "Peroneal kaslar"],
    description:
      "Ayak arkının içe doğru çökmesidir; ayak bileği-diz hattını etkiler.",
    explanation: {
      meaning:
        "Ayak tabanının aşırı içe yuvarlanmasıdır. Ayak-diz-kalça zincirini bozabilir.",
      daily_life:
        "Uzun yürüyüşte ayak/baldır yorgunluğu ve diz iç yüzünde rahatsızlık olabilir.",
      sport_performance:
        "Koşuda enerji kaybı ve aşırı kullanım yaralanmalarına zemin hazırlar.",
      recovery_time: "6-12 hafta; gerekirse tabanlık desteği.",
      cautions:
        "Ağrı sürerse podolog/fizyoterapi değerlendirmesi ve uygun ayakkabı önerilir.",
    },
    assessment: "Ayakta dururken ayak arkların içe doğru çöküyor mu?",
    corrective: {
      mobilization: ["ankle_mob"],
      activation: ["single_leg_balance", "vmo"],
      strengthening: ["calf_raise", "single_leg_balance"],
      stretching: ["calf_stretch"],
      cooldown: ["diaphragmatic_breathing"],
    },
  },

  shoulder_asymmetry: {
    label: "Omuz Asimetrisi",
    english: "Shoulder Asymmetry",
    view: "front",
    defaultRisk: "moderate",
    affected_muscles: ["Omuz kuşağı", "Boyun", "Üst sırt"],
    weak_muscles: ["Düşük taraf alt trapez", "Yüksek taraf orta trapez dengesi"],
    tight_muscles: ["Yüksek taraf üst trapez / levator"],
    description:
      "Bir omzun diğerinden belirgin yüksek/alçak durmasıdır; genelde tek taraflı alışkanlıklarla ilişkilidir.",
    explanation: {
      meaning:
        "İki omuz seviyesi arasındaki dengesizliktir. Çanta taşıma, tek kol kullanımı gibi alışkanlıklar etkiler.",
      daily_life:
        "Tek tarafta boyun-omuz gerginliği ve giysilerin dengesiz durması görülebilir.",
      sport_performance:
        "İki taraf arasında kuvvet farkı ve teknik dengesizlik oluşturabilir.",
      recovery_time: "6-10 hafta; tek taraflı denge çalışmalarıyla.",
      cautions:
        "Belirgin ve ağrılı asimetride skolyoz vb. için uzman değerlendirmesi alın.",
    },
    assessment: "Aynada omuzlarından biri diğerine göre belirgin yüksek mi?",
    corrective: {
      mobilization: ["thoracic_rotation", "shoulder_cars"],
      activation: ["lower_trap", "scapular_retraction", "serratus"],
      strengthening: ["face_pull", "row", "ytw"],
      stretching: ["upper_trap_stretch", "lat_stretch"],
      cooldown: ["diaphragmatic_breathing"],
    },
  },

  hip_asymmetry: {
    label: "Kalça Asimetrisi",
    english: "Hip Asymmetry",
    view: "front",
    defaultRisk: "moderate",
    affected_muscles: ["Pelvis", "Bel", "Kalça"],
    weak_muscles: ["Düşük taraf gluteus medius", "Kor stabilizatörleri"],
    tight_muscles: ["Yüksek taraf QL", "Kalça adduktorları"],
    description:
      "Bir kalçanın diğerinden yüksek durmasıdır; pelvik dengesizliği ve bel yükünü etkiler.",
    explanation: {
      meaning:
        "İki kalça seviyesi arasındaki dengesizliktir. Kor-glute dengesizliği veya bacak boyu farkı etkileyebilir.",
      daily_life:
        "Tek tarafta bel/kalça yorgunluğu ve dengesiz yürüme hissi olabilir.",
      sport_performance:
        "Squat/koşuda tek taraf baskınlığı ve yaralanma riski yaratabilir.",
      recovery_time: "6-10 hafta denge ve kor çalışmasıyla.",
      cautions:
        "Belirgin fark veya ağrı varsa bacak boyu farkı için uzman değerlendirmesi alın.",
    },
    assessment: "Ayakta dururken kalçalarından biri diğerine göre yüksek mi duruyor?",
    corrective: {
      mobilization: ["hip_flexor_mob", "cat_camel"],
      activation: ["glute_bridge", "clamshell", "core_deadbug"],
      strengthening: ["hip_thrust", "side_plank", "pallof"],
      stretching: ["hip_flexor_stretch", "ql_stretch"],
      cooldown: ["diaphragmatic_breathing", "supine_twist"],
    },
  },
  anterior_pelvic_tilt: {
    label: "Öne Pelvik Eğim",
    english: "Anterior Pelvic Tilt",
    view: "side",
    defaultRisk: "moderate",
    affected_muscles: ["Bel", "Kalça", "Kor"],
    weak_muscles: ["Gluteus maksimus", "Kor (transversus/rektus abdominis)", "Hamstring"],
    tight_muscles: ["Kalça fleksörleri (iliopsoas)", "Bel ekstansörleri (erektör spina)", "Rektus femoris"],
    description: "Pelvisin öne doğru eğilmesiyle bel çukurunun artmasıdır; alt çapraz sendromla ilişkilidir.",
    explanation: {
      meaning: "Pelvisin öne rotasyonuyla bel eğriliğinin (lordoz) belirginleşmesidir.",
      daily_life: "Uzun ayakta durmada bel yorgunluğu ve karın öne çıkması görünümü olabilir.",
      sport_performance: "Kalça ekstansiyon gücünü ve squat/deadlift mekaniğini bozabilir.",
      recovery_time: "6-12 hafta kalça fleksörü esnetme + glute/kor güçlendirme ile.",
      cautions: "Kalıcı bel ağrısı/uyuşma varsa fizyoterapi değerlendirmesi önerilir.",
    },
    assessment: "Yandan bakıldığında bel çukurun belirgin, kalçan geride ve karnın öne mi eğik?",
    corrective: {
      mobilization: ["hip_flexor_mob", "cat_camel"],
      activation: ["glute_bridge", "core_deadbug", "bird_dog"],
      strengthening: ["hip_thrust", "rdl", "plank"],
      stretching: ["hip_flexor_stretch", "ql_stretch"],
      cooldown: ["diaphragmatic_breathing", "child_pose"],
    },
  },
  posterior_pelvic_tilt: {
    label: "Arkaya Pelvik Eğim",
    english: "Posterior Pelvic Tilt",
    view: "side",
    defaultRisk: "moderate",
    affected_muscles: ["Bel", "Kalça"],
    weak_muscles: ["Kalça fleksörleri (iliopsoas)", "Bel ekstansörleri", "Erektör spina"],
    tight_muscles: ["Hamstring", "Gluteus maksimus", "Rektus abdominis"],
    description: "Pelvisin arkaya eğilmesiyle bel düzleşmesidir; oturma alışkanlıklarıyla ilişkilidir.",
    explanation: {
      meaning: "Pelvisin arkaya rotasyonuyla belin doğal eğriliğinin azalmasıdır.",
      daily_life: "Bel bölgesinde tutukluk ve düz sırt görünümü olabilir.",
      sport_performance: "Kalça fleksiyonunda kısıtlılık ve bel yükünde dengesizlik yaratabilir.",
      recovery_time: "6-12 hafta hamstring esnetme + bel/kalça fleksör aktivasyonu ile.",
      cautions: "Ağrı sürerse uzman değerlendirmesi alın.",
    },
    assessment: "Yandan bakıldığında belin düzleşmiş ve kalçan içe/altta mı görünüyor?",
    corrective: {
      mobilization: ["cat_camel", "hip_flexor_mob"],
      activation: ["core_deadbug", "bird_dog"],
      strengthening: ["rdl", "plank", "pallof"],
      stretching: ["hip_flexor_stretch", "calf_stretch"],
      cooldown: ["diaphragmatic_breathing", "supine_twist"],
    },
  },
  knee_varus: {
    label: "Diz Dışa Açıklık (O Bacak)",
    english: "Knee Varus",
    view: "front",
    defaultRisk: "moderate",
    affected_muscles: ["Diz", "Kalça", "Ayak bileği"],
    weak_muscles: ["Peroneal kaslar", "Vastus medialis (VMO)", "Gluteus medius"],
    tight_muscles: ["Tensor fasya lata / IT bandı", "Baldır dış kısmı", "Adduktörler"],
    description: "Dizlerin dışa açılmasıyla bacakların 'O' formu almasıdır.",
    explanation: {
      meaning: "Diz eklemlerinin gövde orta hattından dışa açılmasıdır.",
      daily_life: "Diz iç/dış yüzünde yüklenme ve yürüyüşte yorgunluk olabilir.",
      sport_performance: "Diz stabilitesini azaltır, aşırı kullanım yaralanma riskini artırır.",
      recovery_time: "8-12 hafta hedefli güçlendirme ile.",
      cautions: "Belirgin deformite/ağrı varsa ortopedik değerlendirme önerilir.",
    },
    assessment: "Ayakları bitişik dururken dizlerin arasında belirgin boşluk var mı?",
    corrective: {
      mobilization: ["ankle_mob", "hip_flexor_mob"],
      activation: ["monster_walk", "clamshell", "vmo"],
      strengthening: ["glute_bridge", "single_leg_balance", "calf_raise"],
      stretching: ["calf_stretch", "hip_flexor_stretch"],
      cooldown: ["diaphragmatic_breathing"],
    },
  },
  flat_feet: {
    label: "Düz Tabanlık",
    english: "Flat Feet",
    view: "front",
    defaultRisk: "moderate",
    affected_muscles: ["Ayak", "Ayak bileği", "Diz"],
    weak_muscles: ["Tibialis posterior", "Ayak içi (intrinsik) kaslar", "Gluteus medius"],
    tight_muscles: ["Baldırlar (gastroknemius/soleus)", "Peroneal kaslar"],
    description: "Ayak arkının çökmesiyle tabanın yere tam temas etmesidir.",
    explanation: {
      meaning: "Ayak medial arkının düşük olması/çökmesidir; pronasyonla ilişkilidir.",
      daily_life: "Uzun yürüyüşte ayak/baldır yorgunluğu ve diz iç yüzü rahatsızlığı olabilir.",
      sport_performance: "Koşuda enerji kaybı ve aşırı kullanım yaralanmalarına zemin hazırlar.",
      recovery_time: "8-12 hafta; gerekirse tabanlık desteği.",
      cautions: "Ağrı sürerse podolog/fizyoterapi değerlendirmesi ve uygun ayakkabı önerilir.",
    },
    assessment: "Ayakta dururken ayak arkın yere tamamen temas ediyor mu?",
    corrective: {
      mobilization: ["ankle_mob"],
      activation: ["single_leg_balance", "vmo", "calf_raise"],
      strengthening: ["calf_raise", "single_leg_balance", "monster_walk"],
      stretching: ["calf_stretch"],
      cooldown: ["diaphragmatic_breathing"],
    },
  },
  winged_scapula: {
    label: "Kanat Skapula",
    english: "Winged Scapula",
    view: "back",
    defaultRisk: "moderate",
    affected_muscles: ["Skapula", "Üst sırt", "Omuz"],
    weak_muscles: ["Serratus anterior", "Alt trapez", "Orta trapez"],
    tight_muscles: ["Pektoralis minör", "Üst trapez", "Levator skapula"],
    description: "Kürek kemiğinin (skapula) sırttan dışa/kanat gibi belirginleşmesidir.",
    explanation: {
      meaning: "Serratus anterior zayıflığıyla skapulanın göğüs duvarına tam yapışmamasıdır.",
      daily_life: "Omuz üstü hareketlerde zorlanma ve üst sırt yorgunluğu olabilir.",
      sport_performance: "Pres/çekiş hareketlerinde omuz stabilitesini ve kuvvet aktarımını azaltır.",
      recovery_time: "8-12 hafta serratus/alt trapez aktivasyonu ile.",
      cautions: "Ani başlayan belirgin kanatlanma sinir kaynaklı olabilir; uzman değerlendirmesi alın.",
    },
    assessment: "Arkadan bakıldığında kürek kemiklerin sırttan dışa doğru kabarık mı duruyor?",
    corrective: {
      mobilization: ["thoracic_ext", "shoulder_cars"],
      activation: ["serratus", "lower_trap", "scapular_retraction"],
      strengthening: ["row", "face_pull", "ytw"],
      stretching: ["pec_stretch", "lat_stretch"],
      cooldown: ["diaphragmatic_breathing"],
    },
  },
};

export const POSTURE_PROBLEM_LIST = Object.keys(POSTURE_PROBLEMS) as PostureProblem[];

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Düşük",
  moderate: "Orta",
  high: "Yüksek",
};

export const SECTION_LABELS: Record<
  "mobilization" | "activation" | "strengthening" | "stretching" | "cooldown",
  string
> = {
  mobilization: "Mobilizasyon",
  activation: "Aktivasyon",
  strengthening: "Güçlendirme",
  stretching: "Esneme",
  cooldown: "Soğuma",
};

export const POSTURE_DISCLAIMER =
  "Eğitim ve fitness amaçlı önerilerdir. Tıbbi tanı yerine geçmez. Ağrı veya sağlık problemleriniz varsa bir sağlık profesyoneline danışınız.";
