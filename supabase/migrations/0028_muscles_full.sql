-- ============================================================================
-- Migration 0028 — Kapsamlı Kas Kütüphanesi
-- Mevcut 14 ana kas grubuna alt/detay kaslar eklenir (toplam ~42).
-- Her kas SVG haritasındaki en yakın bölgeye (svg_region_id) bağlanır; harita
-- bozulmaz, yeni kaslar "Tüm Kaslar" listesinde ve arama ile erişilir.
-- Idempotent: on conflict (slug) do update.
-- ============================================================================

insert into public.muscles
  (slug, name_tr, latin_name, muscle_group, region, svg_region_id, sort_order,
   overview, functions, origin, insertion, innervation, common_injuries, rehab_notes)
values
-- ---- GÖĞÜS ----
('pektoralis-minor', 'Pektoralis Minor', 'Pectoralis Minor', 'Göğüs', 'front', 'gogus', 21,
 'Göğüs büyük kasının altında yer alan küçük kas; skapulayı öne-aşağı çeker ve nefes almaya yardım eder.',
 array['Skapulanın öne-aşağı çekilmesi (protraksiyon/depresyon)', 'Zorlu nefeste kaburgaların kaldırılması'],
 '3-5. kaburgaların ön yüzü', 'Skapulanın korakoid çıkıntısı', 'Medial pektoral sinir',
 array['Kısalığa bağlı yuvarlak omuz duruşu'], 'Göğüs açıcı esnemeler + skapular retraksiyon çalışması kısalığı dengeler.'),

('serratus-anterior', 'Serratus Anterior', 'Serratus Anterior', 'Göğüs', 'front', 'yan-karin', 22,
 'Kaburgaların yan yüzünde parmak biçiminde uzanan kas; kolu baş üstüne kaldırmak için skapulayı döndürür.',
 array['Skapulanın öne kaydırılması (protraksiyon)', 'Kolu baş üstüne kaldırmada skapula rotasyonu', 'Skapulayı göğüs duvarına sabitleme'],
 '1-9. kaburgaların yan yüzü', 'Skapulanın iç kenarı (ön yüz)', 'Uzun torasik sinir',
 array['Kanat skapula (uzun torasik sinir zayıflığı)'], 'Şınav plus (protraksiyon) ve duvar kaydırma ile aktive et; overhead güç için kritik.'),

-- ---- OMUZ ----
('on-deltoid', 'Ön Deltoid', 'Deltoideus Anterior', 'Omuz', 'front', 'omuz', 23,
 'Deltoidin ön başı; kolu öne ve yukarı kaldırır, itme hareketlerine güç katar.',
 array['Omuz fleksiyonu (kolu öne kaldırma)', 'Kolun iç rotasyonu ve horizontal adduksiyon'],
 'Klavikula dış üçte biri', 'Humerus deltoid tüberositesi', 'Aksiller sinir',
 array['Bench press aşırı yüklenmesinde ön omuz ağrısı'], 'Ön omuz genelde çok çalışır; arka omuz ve rotator dengesi ile aşırı yükü azalt.'),

('yan-deltoid', 'Yan Deltoid', 'Deltoideus Lateralis', 'Omuz', 'front', 'omuz', 24,
 'Deltoidin orta başı; omuz genişliğini veren, kolu yana kaldıran ana kas.',
 array['Omuz abduksiyonu (kolu yana kaldırma, 15-90°)'],
 'Akromion (omuz çıkıntısı)', 'Humerus deltoid tüberositesi', 'Aksiller sinir',
 array['Sıkışma sendromu (impingement)'], 'Lateral raise ile izole et; ağrısız açıklıkta çalış, tepe noktada duraksama.'),

('arka-deltoid', 'Arka Deltoid', 'Deltoideus Posterior', 'Omuz', 'back', 'omuz', 25,
 'Deltoidin arka başı; kolu geriye çeker, duruş ve omuz sağlığı için önemli ama sık ihmal edilir.',
 array['Omuz ekstansiyonu (kolu geriye alma)', 'Horizontal abduksiyon', 'Dış rotasyona yardım'],
 'Spina skapula (omuz kemiği çıkıntısı)', 'Humerus deltoid tüberositesi', 'Aksiller sinir',
 array['Ön-arka omuz dengesizliği'], 'Face pull ve reverse fly ile güçlendir; sağlıklı omuz için ön omuzla dengele.'),

('rotator-manset', 'Rotator Manşet', 'Rotator Cuff', 'Omuz', 'back', 'omuz', 26,
 'Omuz eklemini saran 4 küçük kasın (supraspinatus, infraspinatus, teres minor, subskapularis) ortak adı; başın yuvada stabilitesini sağlar.',
 array['Omuz başının yuvada merkezlenmesi (stabilite)', 'İç ve dış rotasyon'],
 'Skapulanın çeşitli bölgeleri', 'Humerus başı (tüberküller)', 'Suprascapular, aksiller, subskapular sinirler',
 array['Rotator manşet yırtığı', 'Tendinit'], 'Hafif bant ile dış/iç rotasyon; ağır overhead öncesi ısınmada mutlaka çalıştır.'),

('supraspinatus', 'Supraspinatus', 'Supraspinatus', 'Omuz', 'back', 'omuz', 27,
 'Rotator manşetin üst kası; abduksiyonun ilk 15°''sini başlatır ve omuz başını sabitler.',
 array['Abduksiyonun başlatılması (ilk 15°)', 'Omuz başının stabilizasyonu'],
 'Skapula supraspinöz çukur', 'Humerus büyük tüberkül (üst)', 'Suprascapular sinir',
 array['Supraspinatus tendiniti/yırtığı (en sık manşet yaralanması)'], 'Ağrısız açıklıkta hafif abduksiyon; sıkışmayı önlemek için 90° üstünü zorlama.'),

('infraspinatus', 'Infraspinatus', 'Infraspinatus', 'Omuz', 'back', 'omuz', 28,
 'Rotator manşetin arka kası; kolun dış rotasyonundan sorumlu ana kas.',
 array['Omuzun dış rotasyonu', 'Omuz başının arkada stabilizasyonu'],
 'Skapula infraspinöz çukur', 'Humerus büyük tüberkül (orta)', 'Suprascapular sinir',
 array['Dış rotator zayıflığı → omuz sıkışması'], 'Yan yatarak dış rotasyon (side-lying ER) ile güçlendir.'),

-- ---- KOL ----
('brachialis', 'Brachialis', 'Brachialis', 'Kol', 'front', 'biceps', 29,
 'Bicepsin altında yer alan güçlü dirsek bükücü; kol kalınlığının önemli kısmını oluşturur.',
 array['Dirsek fleksiyonu (avuç yönünden bağımsız en güçlü bükücü)'],
 'Humerus alt yarısı (ön yüz)', 'Ulna koronoid çıkıntısı', 'Muskülokutanöz sinir',
 array['Aşırı curl hacminde dirsek ön ağrısı'], 'Hammer curl ve ters curl ile hedefle; nötr tutuş brachialisi öne çıkarır.'),

('brachioradialis', 'Brachioradialis', 'Brachioradialis', 'Kol', 'front', 'on-kol', 30,
 'Ön kolun dış yüzündeki uzun kas; nötr tutuşta dirseği büker, kavrama gücüne katkı verir.',
 array['Dirsek fleksiyonu (nötr/pronasyon tutuşta)', 'Ön kol nötral konuma getirme'],
 'Humerus dış alt kenarı', 'Radius alt ucu (stiloid çıkıntı)', 'Radial sinir',
 array['Tenisçi dirseğine eşlik eden ön kol ağrısı'], 'Hammer/ters curl ile çalış; kavrama antrenmanıyla birlikte gelişir.'),

('on-kol-fleksor', 'Ön Kol Fleksörleri', 'Flexor Grubu (Ön Kol)', 'Kol', 'front', 'on-kol', 31,
 'Ön kolun iç yüzündeki bilek/parmak bükücü kaslar; kavrama gücünün temeli.',
 array['Bilek fleksiyonu', 'Parmakların bükülmesi (kavrama)'],
 'Humerus iç epikondil', 'El bilek/parmak kemikleri', 'Median ve ulnar sinirler',
 array['Golfçü dirseği (medial epikondilit)'], 'Bilek curl ve ölü asılma (dead hang) ile kademeli yükle.'),

('on-kol-ekstansor', 'Ön Kol Ekstansörleri', 'Ekstansör Grubu (Ön Kol)', 'Kol', 'back', 'on-kol', 32,
 'Ön kolun dış yüzündeki bilek/parmak açıcı kaslar; kavrama dengesini ve bilek sağlığını sağlar.',
 array['Bilek ekstansiyonu', 'Parmakların açılması'],
 'Humerus dış epikondil', 'El bilek/parmak kemikleri', 'Radial sinir',
 array['Tenisçi dirseği (lateral epikondilit)'], 'Ters bilek curl ve eksantrik çalışma ile epikondiliti önle.'),

-- ---- SIRT ----
('romboid', 'Romboid', 'Rhomboideus Major/Minor', 'Sırt', 'back', 'sirt', 33,
 'Kürek kemiklerini omurgaya çeken kaslar; dik duruşun ve sıkı sırt hissinin anahtarı.',
 array['Skapula retraksiyonu (kürekleri birbirine yaklaştırma)', 'Skapulanın aşağı rotasyonu'],
 'C7-T5 omurga çıkıntıları', 'Skapulanın iç kenarı', 'Dorsal skapular sinir',
 array['Zayıflığa bağlı öne düşük omuz'], 'Row ve face pull''da kürekleri sık; masabaşı duruşu için kritik.'),

('teres-major', 'Teres Major', 'Teres Major', 'Sırt', 'back', 'sirt', 34,
 'Latissimusa yardımcı küçük kas ("lat''ın küçük yardımcısı"); kolu aşağı ve içe çeker.',
 array['Omuz ekstansiyonu', 'Kolun iç rotasyonu ve adduksiyonu'],
 'Skapula alt köşesi', 'Humerus (küçük tüberkül kresti)', 'Alt subskapular sinir',
 array['Çekiş hacminde arka koltuk altı gerginliği'], 'Lat çalışmalarıyla birlikte gelişir; ayrı izolasyon nadiren gerekir.'),

('levator-skapula', 'Levator Skapula', 'Levator Scapulae', 'Sırt', 'back', 'trapez', 35,
 'Boyun yanından kürek kemiğine uzanan kas; skapulayı yukarı kaldırır, stres kaynaklı gerginlikte sık tutulur.',
 array['Skapulanın yukarı kaldırılması (elevasyon)', 'Boynun yana eğilmesi'],
 'C1-C4 omurga çıkıntıları', 'Skapula üst iç köşesi', 'Dorsal skapular sinir',
 array['Boyun-omuz gerginliği ve tetik nokta'], 'Boyun yan esneme + trapez alt aktivasyonu ile gevşet.'),

-- ---- KARIN ----
('transvers-karin', 'Transvers Karın', 'Transversus Abdominis', 'Karın', 'front', 'karin', 36,
 'Karnın en derin kası; doğal korse gibi karın içi basıncı ve omurga stabilitesini sağlar.',
 array['Karın içi basıncın oluşturulması (kor stabilite)', 'Belin korunması'],
 'Kaburga kıkırdakları, kalça kemiği, torakolomber fasya', 'Linea alba, kasık', 'Alt interkostal ve lomber sinirler',
 array['Zayıflığa bağlı bel ağrısı'], 'Vakum (karın içe çekme), plank ve nefes kontrolü ile aktive et.'),

-- ---- KALÇA ----
('gluteus-medius', 'Gluteus Medius', 'Gluteus Medius', 'Kalça', 'back', 'kalca', 37,
 'Kalçanın yan üst kısmındaki kas; tek ayak dururken leğeni stabil tutar, diz sağlığı için kritik.',
 array['Kalça abduksiyonu (bacağı yana açma)', 'Yürüyüşte leğen stabilizasyonu'],
 'İliak kanat dış yüzü', 'Femur büyük trokanter', 'Superior gluteal sinir',
 array['Zayıflığa bağlı diz içe çökmesi (valgus)'], 'Yan köprü, clamshell ve bant yürüyüşü ile güçlendir.'),

('gluteus-minimus', 'Gluteus Minimus', 'Gluteus Minimus', 'Kalça', 'back', 'kalca', 38,
 'Gluteus mediusun altındaki en küçük kalça kası; abduksiyon ve leğen stabilitesine yardım eder.',
 array['Kalça abduksiyonu', 'Kalçanın iç rotasyonu', 'Leğen stabilizasyonu'],
 'İliak kanat dış yüzü (alt)', 'Femur büyük trokanter (ön)', 'Superior gluteal sinir',
 array['Kalça yan ağrısı (trokanterik)'], 'Gluteus medius ile birlikte abduksiyon çalışmalarında gelişir.'),

('kalca-fleksor', 'Kalça Fleksörleri', 'Iliopsoas', 'Kalça', 'front', 'on-bacak', 39,
 'Bel omurgasından uyluğa uzanan derin kas grubu (iliakus + psoas); dizi karına doğru çeker.',
 array['Kalça fleksiyonu (uyluğu öne-yukarı çekme)', 'Duruşta bel eğriliğine etki'],
 'Bel omurları ve iliak çukur', 'Femur küçük trokanter', 'Femoral sinir ve lomber pleksus',
 array['Uzun oturmaya bağlı kısalık ve bel ağrısı'], 'Ayakta kalça fleksör esnemesi + gluteus aktivasyonu ile dengele.'),

('adduktor', 'İç Bacak (Adduktörler)', 'Adductor Grubu', 'Bacak', 'front', 'on-bacak', 40,
 'Uyluğun iç yüzündeki kas grubu; bacakları orta hatta çeker, sprint ve yön değiştirmede önemli.',
 array['Kalça adduksiyonu (bacağı içe çekme)', 'Kalça fleksiyon/ekstansiyona yardım'],
 'Kasık kemiği (pubis) ve iskium', 'Femur iç yüzü (linea aspera)', 'Obturator sinir',
 array['Kasık zorlanması (adduktor strain)'], 'Copenhagen plank ve kontrollü adduksiyon ile kademeli güçlendir.'),

-- ---- BACAK: QUADRICEPS ----
('rektus-femoris', 'Rektus Femoris', 'Rectus Femoris', 'Bacak', 'front', 'on-bacak', 41,
 'Quadricepsin ortadaki kası; hem kalçayı büker hem dizi düzeltir (iki eklemli).',
 array['Diz ekstansiyonu', 'Kalça fleksiyonu'],
 'Kalça kemiği (AIIS)', 'Patella → tibia (patellar tendon)', 'Femoral sinir',
 array['Sprint/şut sırasında ön uyluk zorlanması'], 'Kalça açık halde diz ekstansiyonu ile hedefle; esneklikle birlikte çalış.'),

('vastus-lateralis', 'Vastus Lateralis', 'Vastus Lateralis', 'Bacak', 'front', 'on-bacak', 42,
 'Uyluğun dış yüzündeki en büyük quadriceps başı; bacak kütlesinin çoğunu verir.',
 array['Diz ekstansiyonu (bacağı düzeltme)'],
 'Femur büyük trokanter ve linea aspera (dış)', 'Patella → tibia', 'Femoral sinir',
 array['Dizde patella dış kayması (tracking)'], 'Squat ve leg press derinliği ile geliştir; vastus medialis ile dengele.'),

('vastus-medialis', 'Vastus Medialis', 'Vastus Medialis (VMO)', 'Bacak', 'front', 'on-bacak', 43,
 'Dizin iç-üst kısmındaki damla biçimli quadriceps başı; diz kapağının hizasını korur.',
 array['Diz ekstansiyonu', 'Diz kapağının iç stabilizasyonu'],
 'Femur linea aspera (iç)', 'Patella (iç) → tibia', 'Femoral sinir',
 array['Diz ön ağrısı (patellofemoral)'], 'Tam açıklıkta squat ve son 30° ekstansiyon ile aktive et.'),

-- ---- BACAK: HAMSTRING ----
('biceps-femoris', 'Biceps Femoris', 'Biceps Femoris', 'Bacak', 'back', 'arka-bacak', 44,
 'Hamstringin dış başı; dizi büker ve kalçayı geri iter, sprintte en sık zorlanan kas.',
 array['Diz fleksiyonu', 'Kalça ekstansiyonu', 'Dizin dış rotasyonu'],
 'İskium (oturak kemiği) ve femur', 'Fibula başı', 'Siyatik sinir (tibial + fibular)',
 array['Hamstring yırtığı (sprint yaralanması)'], 'Nordic curl ve Romanian deadlift ile eksantrik güç kazandır.'),

('semitendinosus', 'Semitendinozus', 'Semitendinosus', 'Bacak', 'back', 'arka-bacak', 45,
 'Hamstringin iç başlarından biri; diz bükme ve kalça ekstansiyonuna katkı verir.',
 array['Diz fleksiyonu', 'Kalça ekstansiyonu', 'Dizin iç rotasyonu'],
 'İskium (oturak kemiği)', 'Tibia iç yüzü (pes anserinus)', 'Siyatik sinir (tibial)',
 array['İç hamstring zorlanması'], 'Leg curl ve kalça menteşesi (hinge) ile dengeli çalış.'),

-- ---- BACAK: BALDIR / ÖN BALDIR ----
('soleus', 'Soleus', 'Soleus', 'Bacak', 'back', 'baldir', 46,
 'Gastroknemiusun altındaki derin baldır kası; diz bükükken devreye girer, ayakta durma dayanıklılığını sağlar.',
 array['Ayak bileği plantar fleksiyonu (diz bükükken)', 'Ayakta duruş stabilizasyonu'],
 'Tibia ve fibula (üst arka)', 'Topuk kemiği (Aşil tendonu)', 'Tibial sinir',
 array['Aşil tendinopatisi'], 'Oturarak (diz bükük) topuk kaldırma ile izole et; yüksek tekrar sever.'),

('tibialis-anterior', 'Ön Baldır (Tibialis Anterior)', 'Tibialis Anterior', 'Bacak', 'front', 'on-bacak', 47,
 'Kaval kemiğinin dış-önündeki kas; ayak ucunu yukarı kaldırır, koşuda kontrollü iniş sağlar.',
 array['Ayak bileği dorsifleksiyonu (ayak ucunu kaldırma)', 'Ayağın içe dönmesi (inversiyon)'],
 'Tibia dış yüzü (üst)', 'İç ayak tarağı (medial kuneiform)', 'Derin fibular sinir',
 array['Shin splints (kaval ağrısı)'], 'Topuk üstünde yürüme ve dorsifleksiyon ile güçlendir; koşucu sakatlığını azaltır.'),

-- ---- BOYUN ----
('boyun', 'Boyun (SCM)', 'Sternocleidomastoideus', 'Boyun', 'front', 'trapez', 48,
 'Boynun yan-önündeki belirgin kas; başı çevirir ve öne eğer, duruş dengesinde rol oynar.',
 array['Başın karşı yöne çevrilmesi', 'Boynun öne eğilmesi (fleksiyon)', 'Zorlu nefeste yardım'],
 'Sternum ve klavikula', 'Kafatası (mastoid çıkıntı)', 'Aksesuar sinir (CN XI)',
 array['Boyun tutulması (tortikolis)', 'Teknoloji boynu gerginliği'], 'Nazik boyun germe + derin boyun fleksör (çene içe çekme) çalışması ile dengele.')

on conflict (slug) do update set
  name_tr=excluded.name_tr, latin_name=excluded.latin_name, muscle_group=excluded.muscle_group,
  region=excluded.region, svg_region_id=excluded.svg_region_id, sort_order=excluded.sort_order,
  overview=excluded.overview, functions=excluded.functions, origin=excluded.origin,
  insertion=excluded.insertion, innervation=excluded.innervation,
  common_injuries=excluded.common_injuries, rehab_notes=excluded.rehab_notes;
