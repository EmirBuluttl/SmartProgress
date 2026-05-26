# SmartProgress AI Premium Spec v1

Bu doküman SmartProgress'in premium AI mimarisini, ürün paketlerini, koçluk kurallarını ve karar motorunu tanımlar. Amaç, AI'ın rastgele program yazan bir sohbet botu değil, SmartProgress algoritmasına bağlı çalışan bilimsel ve kontrollü bir fitness mentoru olmasıdır.

## Ürün Felsefesi

SmartProgress'in temel amacı sürdürülebilir progress üretmektir. Kullanıcıya gereksiz hacim, rastgele egzersiz veya sürekli program değişikliği dayatmak yerine; minimum etkili hacim, doğru RIR takibi, düzenli loglama ve kontrollü müdahale ile ilerleme sağlanır.

AI karar verici ana otorite değildir. Ana kararlar SmartProgress Rule Engine tarafından verilir. AI katmanı bu kararları kullanıcıya anlaşılır, premium ve motive edici bir dille açıklar.

## Paketler

### Free

- Antrenman loglama
- Program oluşturma ve takip
- Temel progress grafikleri
- Topluluk / keşfet programları
- Temel bilgi merkezi

### SmartProgress Pro

- SmartProgress Rule Engine
- AI Koç sekmesi
- Kişisel program oluşturma
- Split önerisi
- Progress / plato analizi
- Haftalık rapor
- Bekleyen kararlar
- Gelişmiş grafikler
- Program dışı hacim ve recovery yorumları
- Gelişmiş bilgi merkezi
- AI sohbet yoktur veya çok sınırlıdır

### SmartProgress Coach+

- Pro paketindeki her şey
- AI Koç ile konuşma
- Aylık sınırlı AI soru hakkı
- Daha detaylı açıklamalar
- Kullanıcının öneriler hakkında soru sorabilmesi

İlk fiyatlandırma fikri:

- Pro: 99 TL - 149 TL / ay
- Coach+: 249 TL - 399 TL / ay

Kesin fiyat, mağaza komisyonu, vergi, AI maliyeti ve gerçek kullanım verisine göre netleştirilmelidir.

## MVP Ürün Kararları

- Pro haftalık raporu AI tarafından yazılmış metinle sunulacaktır.
- Coach+ için başlangıç AI soru hakkı 50 soru / ay olacaktır.
- 50 soru limiti token maliyeti ve gerçek kullanım verilerine göre ileride değiştirilebilir.
- Bilgi merkezi herkes için açık olacaktır.
- AI Koç ana tab bar'da ayrı bir sekme olarak yer alacaktır.
- Pro paketinde isimlendirme "Akıllı Koç", Coach+ paketinde "AI Koç" olarak ayrıştırılacaktır.
- İlk MVP'de gerçek ödeme sistemi kurulmayacaktır.
- Premium erişim manuel admin / veritabanı flag'i ile test edilecektir.
- Ödeme sistemi, ürün akışı ve koçluk sistemi sorunsuz hale geldikten sonra eklenecektir.
- AI program oluşturma mevcut free program oluşturma ekranının içine sıkıştırılmayacaktır.
- Premium için ayrı bir program oluşturma wizard'ı olacaktır.
- Premium kullanıcı oluşturulan programı yine mevcut program kütüphanesi ve mevcut loglama ekranları üzerinden takip edecektir.
- Kullanıcı abonelik durumu `subscriptionTier` ve `subscriptionStatus` alanlarıyla tutulacaktır.
- `subscriptionTier`: `free`, `pro`, `coach_plus`
- `subscriptionStatus`: `active`, `inactive`, `trial`
- Tab bar'daki koçluk sekmesi herkes için "Koç" adını kullanacaktır.
- Sekme içeriği kullanıcının paketine göre değişecektir.
- Coach+ kullanımında token budget soru sayısından daha önceliklidir.
- Kullanıcı belirlenen dollarwise AI bütçeyi aşmamalıdır.
- 50 soru / ay limiti token budget güvenliyse korunur, değilse düşürülebilir.
- Haftalık AI raporu otomatik oluşturulacak ve cache'lenecektir.
- Kullanıcı Koç sekmesini açtığında rapor hazır gelmelidir.
- Pro kullanıcılara müdahale önerilerinde kısa sebep gösterilecektir.
- Detaylı "neden?" soruları ve sohbet Coach+ paketine ait olacaktır.
- Bilgi merkezi ilk MVP'de frontend içinde statik JSON / Markdown içerik olarak tutulacaktır.
- Coach+ kullanıcı başına ilk aylık AI bütçe hard cap'i 1.50 USD olacaktır.
- Coach+ için 1.00 USD seviyesinde iç alarm tutulacaktır.
- Pro kullanıcıların haftalık AI raporu / metin üretimi ayrı düşük bütçeli cap altında izlenecektir.
- Pro rapor/metin cap'i başlangıçta kullanıcı başı aylık 0.25 - 0.50 USD aralığında planlanacaktır.
- Haftalık rapor yalnızca anlamlı log verisi varsa üretilecektir.
- Log sessionlar aksatılmışsa rapor yerine "veri yetersiz / bu hafta yeterli log yok" deneyimi gösterilecektir.
- Free kullanıcı Koç tab'ında teaser ve Pro / Coach+ karşılaştırması görecektir.
- Bilgi merkezi Koç tab'ının içine sıkıştırılmayacak, ayrı bir kısım olarak konumlanacaktır.
- Wizard'da kullanıcı ekipman seçmezse tam salon varsayıldığı açıkça belirtilecektir.
- AI önerisi reddedilirse kullanıcıya opsiyonel kısa sebep sorulacaktır.
- İlk MVP rule engine ile başlayacaktır.
- OpenAI API bağlanmadan önce premium görünümlü copy template'ler kullanılacaktır.
- Bu template'ler kaba mock metin gibi görünmemeli; ürün diliyle hazırlanmış, değişkenleri rule engine çıktılarıyla dolan kontrollü premium metinler olmalıdır.

## AI Maliyet Prensipleri

- AI her logdan sonra ham geçmişi analiz etmez.
- Backend önce rule engine ile karar üretir.
- AI yalnızca karar özetini kullanıcı diline çevirir.
- Uzun geçmiş yerine özet veri gönderilir.
- AI çıktıları mümkün olduğunca cache'lenir.
- Coach+ soru hakkı sınırlı tutulur.
- Kullanıcı başı AI maliyeti backend'de aylık ledger ile izlenir.
- Coach+ kullanıcı başına aylık hard cap ilk MVP'de 1.50 USD'dir.
- Coach+ için 1.00 USD seviyesinde iç alarm tutulur.
- Pro rapor ve metin üretimleri Coach+ chat bütçesinden ayrı izlenir.
- Pro kullanıcı başı aylık rapor / metin cap'i başlangıçta 0.25 - 0.50 USD aralığında planlanır.

İlk hedef:

- Pro kullanıcılarında AI maliyeti çok düşük ve öngörülebilir kalmalı.
- Coach+ kullanıcılarında aylık token / soru limiti olmalı.
- Tasarımda kullanıcı başı maksimum AI maliyeti yüksek hata payı ile takip edilmeli.

## AI Uygulama Deneyimi

AI sürekli her sayfada gezen bir sohbet balonu olarak başlamaz. İlk ürün deneyimi üç seviyelidir:

### Koç Tab İkon Prototipleri

İlk implementation sırasında birkaç ikon prototipi denenir. Amaç fazla klişe "AI brain / sparkle" görünümünden kaçıp fitness ve koçluk hissi veren sade bir ikon bulmaktır.

Adaylar:

- Dumbbell + pulse: fitness ve progress hissi verir.
- Clipboard-check: koç planı ve takip hissi verir.
- Target: hedef ve odak hissi verir.
- Activity: canlı performans / progress hissi verir.
- Route: yol haritası ve yönlendirme hissi verir.

İlk UI denemesinde en okunaklı ve tab bar içinde en az sıkışan ikon seçilir.

### AI Koç Sekmesi

Premium değerin merkezi burasıdır.

İçerik:

- Bugünkü koç notu
- Sıradaki antrenman hedefleri
- Bekleyen kararlar
- Progress / takip / müdahale adayı durumları
- Haftalık rapor
- Bilgi merkezi bağlantıları
- Coach+ için AI'a sor alanı

### Moment İçindeki Koç Dokunuşları

AI sadece ilgili bağlamda küçük kartlarla görünür.

Örnekler:

- Antrenman başlamadan önce: "Bugün Bench Press'te aynı kiloyla +1 tekrar hedefle."
- Log ekranında: "Daha iyi analiz için RIR girebilirsin."
- Antrenman bitince: "Lateral Raise hedef aralığın üstüne çıktı; sıradaki session'da minimum ağırlık artışı denenebilir."

### Bildirim Merkezi

Önemli olaylar bildirim olarak bırakılır.

Örnekler:

- Haftalık rapor hazır
- Set artırımı öneriliyor
- Plato müdahale adayı oluştu
- Program dışı hacim recovery'yi etkileyebilir

## Bilgi Merkezi

Bilgi merkezi statik veya düşük maliyetli içeriklerden oluşur. Amaç, kullanıcıların basit sorular için AI soru hakkını harcamamasıdır.

Bilgi merkezi Koç tab'ının içine sıkıştırılmaz. Uygulamada ayrı bir kısım olarak konumlanır ve herkese açık olur.

İlk içerikler:

- RIR nedir?
- RPE nedir?
- Set arası ne kadar dinlenilmeli?
- Warmup nasıl yapılmalı?
- Progress nedir?
- Plato nedir?
- Neden sürekli program değiştirmemeliyim?
- Program dışı hacim recovery'yi nasıl etkiler?
- Kardiyo antrenmanı etkiler mi?
- BW hareketlerde yük nasıl hesaplanır?

## Kullanıcı Seviyeleri

### Başlangıç

Tanım:

- Sıfır tecrübe
- Yeni başlamış kullanıcı
- Form, düzen ve temel alışkanlık önceliklidir

Kurallar:

- RIR hedefi: 2-3
- İzole / compound ayrımı yapılmaz
- Failure önerilmez
- Amaç teknik öğrenme ve sürdürülebilir progress
- Hacim agresif artırılmaz

### Orta Seviye

Tanım:

- Bir süredir antrenman yapan
- Temel hareket ve tükeniş kavramlarına aşina kullanıcı
- Eksikleri olabilir ama çalışma hissini öğrenmeye hazırdır

Kurallar:

- RIR hedefi: 0-1
- Bu nedenle default hacim düşüktür
- Birçok hareket için 1 çalışma seti tercih edilir
- Kullanıcı hızlı progress gösterirse set artırımı düşünülebilir

Hızlı progress örnekleri:

- Aynı tekrar sayısında minimum ağırlık artışı
- Aynı kiloda 2-3 tekrar artışı
- Bu progress'in 1 ilgili session farkla gelmesi

### İleri Seviye

Tanım:

- Bilgisi ve deneyimi yüksek
- Programlamaya aşina
- Daha çok çalışma değil, daha az hata payı gerekir

Kurallar:

- RIR hedefi: 1-2
- Daha fazla hacim değil, daha iyi yorgunluk yönetimi önceliklidir
- Egzersiz sırası, RIR hedefi, hareket seçimi ve recovery ince ayarları öne çıkar
- Hacim artırımı en son seçeneklerden biridir

## Minimum AI Onboarding Bilgileri

Zorunlu:

- Seviye
- Haftalık antrenman günü
- Sakatlık / ağrı var mı

Opsiyonel:

- Ana hedef
- Session süresi
- Ekipman erişimi
- Öncelikli kas grubu
- Sevmediği / kaçındığı hareketler
- Sevdiği hareketler
- Kardiyo hedefi
- Boy / kilo
- Uyku kalitesi
- Stres seviyesi
- Beslenme kalitesi
- RIR / RPE kullanma isteği

Varsayılanlar:

- Hedef girilmezse: kas kazanımı + sürdürülebilir progress
- Ekipman girilmezse: tam salon erişimi
- Session süresi girilmezse: haftalık frekansa uygun ortalama süre

## Program Oluşturma Akışı

Premium program oluşturma koç eşliğinde kişiselleştirme mantığıyla ilerler.

Genel akış:

1. Kullanıcı minimum bilgileri verir.
2. AI uygun splitleri önerir.
3. Split önerisinin nedeni açıklanır.
4. Kullanıcı önerilen splitlerden birini seçer.
5. AI gün / patern yapısını oluşturur.
6. Kullanıcı her patern için önerilen hareketlerden seçim yapar.
7. Program kullanıcının kütüphanesine eklenir.
8. Program otomatik olarak aktif takip edilen program olur.
9. AI Koç sekmesi takip döngüsünü başlatır.

İlk MVP wizard adımları:

1. Seviye
2. Haftalık antrenman günü
3. Ağrı / sakatlık
4. Hedef / ekipman / session süresi
5. Öncelikli kas ve kaçınılan hareketler
6. Split seçimi
7. Egzersiz seçimi
8. Özet ve oluştur

Premium AI programları default private olmak zorunda değildir. Kullanıcı isterse public yapabilir. SmartProgress'in asıl değeri programın gizliliği değil, program takibi ve koçluk döngüsüdür.

## Split Seçim Motoru

### 2 Gün

- Önce 3 güne çıkması önerilir.
- Mümkün değilse yüksek hacimli Full Body önerilir.

### 3 Gün

- Default öneri: Full Body
- Frekans / verim oranı en mantıklı seçenektir.

### 4 Gün

Kullanıcıya splitlerin farkı açıklanır.

- Upper / Lower: bacak eksikse veya bacak gelişimi öncelikliyse önerilir.
- Anterior / Posterior: aynı gün göğüs ve sırt çalışmayı sevmiyorsa / istemiyorsa önerilir.
- Torso / Limbs: kollar eksik bölgeyse veya kol gelişimi öncelikliyse önerilir.

### 5 Gün

İki senaryo vardır:

- Esnek düzen: UL / AP / TL döngüsü workout / workout / off / workout / workout / off şeklinde devam edebilir.
- Sabit haftalık düzen: workout / workout / off / workout / workout / off / off önerilebilir.

PPLUL opsiyonu da kullanıcı tercihi ve recovery durumuna göre sunulabilir.

### 6 Gün

- workout / workout / workout / workout / workout / workout / off
- PPL veya uygun 6 günlük splitler önerilebilir.

### 7 Gün

- Resistance training için izin verilmez.
- En az 1 off günü gerekli görülür.
- Kullanıcı 7 gün istiyorsa 6 gün split + 1 gün kardiyo / mobilite planı önerilebilir.

## Öncelikli Kas Mantığı

Öncelikli kas seçilirse:

1. Kas ilgili hareket paterniyle eşleştirilir.
2. İlgili egzersiz ilgili günün başına alınır.
3. Başlangıçta set artırımı yapılmaz.
4. Set artırımı yalnızca progress anomalisi / kapasite sinyali varsa değerlendirilir.

Örnek:

- Öncelik: yan omuz
- Patern: shoulder abduction
- Egzersiz seçenekleri: Starting Hip Cable Lateral Raise, Machine Lateral Raise, Seated Dumbbell Lateral Raise, Upright Row
- İlgili günlerde shoulder abduction egzersizi öne alınır.

## Progress Kararları

### Progress Önceliği

1. Aynı harekette ağırlık artışı en değerli progress sinyalidir.
2. Aynı kiloda tekrar artışı ikinci değerli sinyaldir.
3. Kilo ve tekrar birlikte artmışsa çok güçlü progress sinyalidir.
4. Kilo düşüp tekrar artmışsa dikkatli yorumlanır.
5. Kilo artıp tekrar düşmüşse hedef tekrar aralığının altına düşmüyorsa progress sayılabilir.

### Ağırlık Progress

```text
weightProgressPercent = ((newLoad - oldLoad) / oldLoad) * 100
```

BW hareketlerinde:

```text
totalLoad = bodyWeight + externalLoad
```

### Tekrar Progress Katsayıları

```text
+1 tekrar = %2
+2 tekrar = %5
+3 tekrar = %7
+4 tekrar = %8
+5 tekrar = %9
+6 tekrar = %10
```

3 tekrardan sonra her ekstra tekrar +1 puan artar.

### Tekrar Aralığı

Programdaki tekrar aralığı progress takibi için kullanılır.

Örnek:

- Hedef: 8-12 tekrar
- Kullanıcı 100 kg ile 8 tekrar yapar
- Sonraki sessionlarda 10 ve sonra 12 tekrara ulaşır
- Üst sınıra ulaştığında ağırlık artırması gerekir
- Yeni ağırlıkla tekrar alt sınıra dönülür

Örnek:

```text
100 kg x 12 -> sonraki hedef: minimum ağırlık artışı ile 8+ tekrar
```

### Minimum Ağırlık Artışı

- Kullanıcıdan hareket / ekipmana göre artırabileceği minimum ağırlık istenir.
- Minimum ağırlık artışı 1 kg altına düşmemelidir.
- AI kör şekilde her hareket için 2.5 kg önermez.

## Set Analizi

Ana karşılaştırma en iyi çalışma seti üzerinden yapılır.

İkincil analiz:

- Toplam çalışma seti performansı
- Setler arası tekrar düşüşü
- Dinlenme süresi
- Kullanıcı feedback'i

Birinci sette progress olup sonraki setlerde tutarsızlık varsa bu progress sayılır; ancak tekrar eden tutarsızlık recovery, odak, dinlenme, uyku, stres veya pre-workout meal sinyali olabilir.

AI önerisi:

- Setler arası minimum 3 dakika dinlen.
- Asıl ölçü: kullanıcı kendini hazır hissetsin ve nefesi normale dönsün.

## Warmup Kuralları

- Warmup setler progress / plato hesabına dahil değildir.
- Warmup kullanıcıyı çalışma setine hazırlamalıdır.
- Yorgunluk biriktiren warmup setleri AI tarafından uyarılabilir.

## RIR / RPE Kuralları

RIR / RPE opsiyoneldir ama önerilen veridir.

Premium varsayılan takip metriği RIR'dır.

RIR / RPE tutarsızlığı varsa:

1. Kullanıcıya uyarı verilir.
2. Kullanıcıdan veriyi düzeltmesi istenir.
3. Kullanıcı "uygun" derse bu veri analizde güvenilir sayılmaz.
4. Veri görmezden gelinebilir veya kullanıcıdan ana takip metriği seçmesi istenebilir.

## Plato ve Müdahale Döngüsü

Plato hareket bazlı değerlendirilir.

Tanımlar:

- Progress: aynı hareket için kilo veya tekrar artışı
- Takip: kısa süreli artış yok ama henüz sorun değil
- Müdahale adayı: aynı harekette 3 ilgili session boyunca progress yok

Müdahale sırası:

1. Aynı programı koru ve veri biriktir.
2. RIR / RPE hedefini rahatlat.
3. Kullanıcı feedback'i al: uyku, beslenme, stres, hareket rahatsızlığı.
4. Set azalt.
5. Hareket değiştir.
6. Split / frekans değiştir.

Kullanıcı değişikliği reddederse:

1. 2 session daha takip edilir.
2. Plato sürerse öneri tekrar yapılır.
3. Yine reddedilirse 3 session daha takip edilir.
4. Plato devam ederse kullanıcıya daha ciddi uyarı gösterilir.
5. Son karar yine kullanıcıdadır.

AI hiçbir program değişikliğini kullanıcı onayı olmadan uygulamaz.

## Set Artırma Kuralları

Set artırımı yalnızca kapasite sinyali varsa düşünülür.

Gerekli koşullar:

- Aynı hareket / patern 2 ilgili session üst üste güçlü progress göstermiş olmalı.
- Kullanıcı feedback'i iyi olmalı.
- RIR hedefi korunmuş olmalı.
- Ağrı / yorgunluk olmamalı.
- Recovery iyi görünmeli.

Set artırıldıktan sonra plato oluşursa önceki müdahale döngüsüne geri dönülür.

## Deload Kuralları

Deload normal çalışma mantığının rutin parçası değildir. Eğer deload gerekiyorsa AI bunu programın kullanıcıya fazla geldiği sinyali olarak görür.

Sıra:

1. RIR yükselt.
2. Plato / gerileme sürerse hacim kıs.
3. Kullanıcı çok yorgun veya gerilemişse 1 session deload öner.
4. Sonra hacmi düşürülmüş programa geç.

## Uyku / Beslenme / Stres

Kullanıcı uyku, beslenme veya stres durumunun kötü olduğunu bildirirse program hemen suçlanmaz.

Kural:

- Recovery kötü ise program korunur.
- Kullanıcı recovery düzeltmeye yönlendirilir.
- Yeterli recovery sağlanmadan program değişikliği yapılmaz.
- Çünkü bu durumda programlama hatası saptanamaz.

## Ağrı / Sakatlık

Ağrı varsa normal progress önerisi durur.

AI:

- Medikal teşhis koymaz.
- Profesyonel destek önerir.
- Hareket alternatifi sunabilir.
- Doktor / uzman kısıtları dahilinde rehab session önerebilir.
- İlgili bölge sakatsa stabil ve güvenli diğer bölge hareketlerini planlayabilir.

## Program Dışı Hareketler

Program dışı hareketler üç kategoriye ayrılır:

1. Program hareketleri: ana analiz bunlardan yapılır.
2. Program dışı ama aynı kas / patern hareketleri: recovery ve hacim hesabına dahil edilir, ana progress kararını bozmaz.
3. Alakasız veya fazla ek hacim: recovery riski olarak işaretlenir.

Kural:

- Ekstra hareketler ana progress kararına dahil olmaz.
- Aynı hedef kas / patern ise toplam yük ve yorgunluk analizine dahil olur.
- Ekstra çalışma toplam çalışma setlerinin %30 üstüne çıkarsa AI uyarı verir.
- Ekstra çalışma sık tekrarlanıyorsa AI "bu hareketi programa dahil etmek ister misin?" diye sorabilir.

## Kardiyo AI

Kardiyo resistance training AI'dan ayrı modül olarak tasarlanır. Ancak yorgunluk analizinde ortak veri kullanılır.

Kardiyo amacı sorulmalıdır:

- VO2 max
- Kondisyon
- Yağ yakımına destek
- Bacak kasları / performans
- Genel sağlık / hareketlilik

Amaç bilinmeden kardiyo önerisi yapılmaz.

Kardiyo yorgunluk analizine dahil edilir. Özellikle yoğun kardiyo leg progress'ini etkileyebilir.

İlk premium MVP'de kardiyo verisi yorgunluk analizinde dikkate alınabilir; detaylı kardiyo koçluğu v1.1 veya sonrasına bırakılabilir.

## AI Öneri Hafızası

AI Koç geçmişi tutulmalıdır.

Tutulacak veriler:

- Öneri tipi
- Öneri sebebi
- İlgili program
- İlgili gün
- İlgili egzersiz
- Kullanıcı cevabı: uygula, reddet, sonra hatırlat
- Öneriden sonra sonuç
- Öneri tarihi
- Güven skoru

## AI Güven Skoru

AI güven skoru iç sistemde tutulur.

Örnek:

- Yüksek güven: düzenli log + RIR/RPE + feedback var
- Orta güven: kilo/tekrar var ama RIR/RPE yok
- Düşük güven: eksik loglar, az veri, program dışı hacim veya tutarsız girişler var

Kullanıcıya her zaman gösterilmez.

## Öneri Sebebi Gösterme

Sebep sistemde her zaman kayıtlı tutulur.

Kullanıcıya sebep şu durumlarda gösterilir:

- Müdahale önerilerinde
- Kullanıcı aynı öneriyi reddettikten sonra tekrar öneri yapılırken
- Haftalık raporda
- Kullanıcı "neden?" diye sorarsa

Basit hedeflerde uzun sebep gösterilmez.

## Haftalık Rapor

Haftalık rapor Pro ve Coach+ deneyiminin önemli parçasıdır.

Rapor, yalnızca anlamlı ve yeterli log verisi varsa üretilir. Kullanıcı haftalık log sessionlarını aksatmışsa rapor yerine veri yetersizliği açıklanır ve daha düzenli loglama önerilir.

Rapor üretimi lazy-generate + cache mantığıyla çalışır:

- Kullanıcı Koç sekmesini açtığında son 7 günlük veriler kontrol edilir.
- Yeterli veri varsa rapor oluşturulur.
- Rapor cache'lenir.
- Aynı haftalık veri için tekrar tekrar AI maliyeti oluşmaz.

İçerik:

- Haftanın en iyi progress'i
- Takipte olan hareketler
- Müdahale adayı hareketler
- Recovery notu
- Gelecek hafta hedefleri
- Bekleyen kararlar

## Rule Engine ve Premium Copy Template Aşaması

İlk MVP'de OpenAI API doğrudan bağlanmadan önce rule engine + premium copy template aşaması kullanılabilir.

Bu aşamada "mock metin" kaba placeholder anlamına gelmez. Metinler ürün diliyle hazırlanmış, premium hissi veren kontrollü şablonlardır. Rule engine çıktıları bu şablonların değişkenlerini doldurur.

Örnek:

```text
Bugünkü odak: {exerciseName} hareketinde {targetInstruction}. Son loglarına göre bu hedef şu an sürdürülebilir görünüyor.
```

Bu yaklaşım:

- Sıfır AI maliyetiyle akış test etmeyi sağlar.
- Rule engine kararlarının doğruluğunu ölçer.
- UI / UX'i gerçek premium hissine yakın test eder.
- OpenAI API bağlandığında değiştirilecek yüzeyi küçültür.

## AI Dil Prensipleri

AI bilimsel ama sade konuşur.

Kötü:

- "Bu hareketi becerememişsin."

İyi:

- "Bu hareket sende beklediğimiz kadar temiz ilerlemiyor. Aynı kası hedefleyen daha stabil bir alternatif deneyebiliriz."

AI kullanıcıyı suçlamaz, yönlendirir.

## İlk MVP Kapsamı

### V1

- Premium paket ayrımı
- AI Koç sekmesi placeholder / teaser
- AI onboarding
- Program oluşturma akışı
- Rule Engine v1
- Progress / plato analizi
- Haftalık rapor
- Öneri hafızası
- Token / usage ledger altyapısı
- Bilgi merkezi

### V1.1

- Coach+ AI chat
- Kardiyo AI detaylı modül
- Daha gelişmiş raporlar
- Kişiselleştirilmiş içerik önerileri

## Implementation Roadmap

1. Koç tab teaser
2. Manual subscription fields
3. Premium wizard
4. Rule Engine v1
5. AI usage ledger / token budget altyapısı
6. Weekly report cache
7. OpenAI API entegrasyonu
8. Bilgi merkezi

Bilgi merkezi ürün için önemli olsa da ilk implementation sırasında sona bırakılır. Çünkü içerik seti henüz yeterince hazır değildir.

## Kapatılan Kararlar

- Pro haftalık raporu AI metniyle sunulacak.
- Coach+ başlangıç limiti 50 soru / ay olacak.
- Bilgi merkezi herkese açık olacak.
- AI Koç ana tab bar'da ayrı bir sekme olacak.
- Pro isimlendirmesi "Akıllı Koç", Coach+ isimlendirmesi "AI Koç" olacak.
- İlk MVP manuel premium flag ile test edilecek.
- AI program oluşturma ayrı bir premium wizard olarak geliştirilecek.
- Abonelik alanları `subscriptionTier` ve `subscriptionStatus` olacak.
- Tab adı herkes için "Koç" olacak, içerik pakete göre değişecek.
- Coach+ için token budget soru sayısından öncelikli olacak.
- Haftalık rapor otomatik oluşturulup cache'lenecek.
- Pro kullanıcı kısa sebep görecek, detaylı sohbet Coach+ olacak.
- Premium wizard 8 adımlı olacak.
- Bilgi merkezi MVP'de frontend statik içerik olacak.
- Coach+ hard cap 1.50 USD, iç alarm 1.00 USD olacak.
- Pro rapor/metin cap'i 0.25 - 0.50 USD aralığında planlanacak.
- Haftalık rapor yalnızca yeterli log verisi varsa üretilecek.
- Free Koç tab'ı teaser + Pro/Coach+ karşılaştırması gösterecek.
- Bilgi merkezi ayrı ve herkese açık bir bölüm olacak.
- Ekipman seçilmezse tam salon varsayımı açıkça gösterilecek.
- Reddedilen AI önerilerinde opsiyonel kısa sebep sorulacak.
- İlk MVP rule engine + premium copy template ile başlayacak.
- Haftalık rapor için yeterli veri eşiği son 7 günde en az 2 completed workout veya aktif program frekansının en az %60'ı olacak.
- Pro / Coach+ manuel flag'i yalnızca admin / veritabanı tarafından değiştirilecek.
- Koç tab ana bottom tab'a eklenecek.
- Koç tab eklenirken şimdilik başka tab kaldırılmayacak.
- Mobilde tab bar sıkışırsa tab düzeni ayrıca revize edilecek.
- Premium copy sıcak "sen" diliyle yazılacak.
- Coach+ chat cevapları default kısa olacak; kullanıcı isterse detaylı açıklama alabilecek.
- Token budget aşılırsa kullanıcıya "Bu ayki AI sohbet hakkın doldu; Pro koç önerilerin çalışmaya devam eder." mesajı gösterilecek.
- AI wizard tamamlandığında kullanıcıya "aktif yap" ve "sadece kütüphaneye ekle" seçenekleri sunulacak.
- Haftalık rapor periyodu kullanıcının son raporundan sonraki 7 gün olarak hesaplanacak.
- Coach+ soru hakkı abonelik başlangıcına göre rolling 30 gün mantığıyla sıfırlanacak.
- İlk MVP'de ödeme sistemi hazır değilken teaser ekranında fiyat gösterilmeyecek; "yakında" dili kullanılacak.

## Açık Sorular

Bu sorular cevaplanmadan implementation başlamamalıdır.

1. AI Koç tab ikon prototipi UI'da denenecek. İlk adaylar: dumbbell + pulse, clipboard-check, target, activity, route.
