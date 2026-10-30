# Proje notları

Son güncelleme: 29 Ekim 2026

## Amaç ve çalışma düzeni

Brifing Bilgi Sistemi; kurum, öğrenci ve personel bilgileri için Firebase Authentication ve Firestore kullanan web uygulamasıdır.

Ana depo: https://github.com/ozbinici07/brifing (herkese açık). Ana dal: main.

Proje farklı bilgisayarlarda GitHub üzerinden geliştirilecek. Bir bilgisayarın diğerine uzaktan bağlanması veya açık tutulması gerekmez. Sohbet geçmişi yerine bu dosya ve Git geçmişi devamlılık sağlar. Tamamlanan her işte bu notlar güncellenir ve kodlarla birlikte GitHub'a gönderilir.

## Firebase Hosting (ana yayın)

- Ana adres: https://brifingbilgisistemi.web.app/
- 29 Ekim 2026 tarihinde Hosting yayını başarıyla tamamlandı; ana sayfa HTTP 200 ve doğru başlıkla doğrulandı.
- mbbs ve bbs site adları başka projelere ayrılmış; kullanıcının seçimi mevcut brifingbilgisistemi adresidir.
- Kök firebase.json yalnızca Hosting içerir. .firebaserc içindeki app hedefi mevcut siteyi seçer. `firebase deploy --only hosting:app --project brifingbilgisistemi` ile yayın yapılır.
- scripts/build-hosting.mjs yalnızca index.html, js, css, assets, vendor ve config/firebase-config.js dosyasını dist/ içine kopyalar. Loglar, geliştirme belgeleri ve kurallar Hosting paketine alınmaz.
- GitHub OAuth girişi başarıyla tamamlandı. CLI etkileşimsiz moda geçtiği için kurulum durmuştu; --interactive ile tamamlandı.
- Firebase CLI yayın için github-action-1438532377 hizmet hesabını ve GitHub’da FIREBASE_SERVICE_ACCOUNT_BRIFINGBILGISISTEMI gizli bilgisini oluşturdu. Anahtar kaynak dosyalarına yazılmadı.
- .github/workflows/firebase-hosting-merge.yml main dalına gönderimde veya elle tetiklendiğinde app hedefine canlı yayın yapar. Yalnızca contents:read depo izni kullanır; PR önizleme yayını kurulmadı.
- Her gönderimden sonra GitHub Actions yayın sonucu kontrol edilmelidir. İlk otomatik yayın başarıyla doğrulandı: https://github.com/ozbinici07/brifing/actions/runs/40909869902 (commit 44ece69). Canlı sayfa HTTP 200 ve doğru başlıkla yanıt verdi.
- Firebase verileri ve Firestore kuralları değiştirilmedi. Hesapla giriş henüz doğrulanmadı.

## GitHub Pages yayını

- GitHub Pages kaynağı main dalı / (root) olarak etkinleştirildi.
- Uygulama adresi: https://ozbinici07.github.io/brifing/
- Main dalına gönderilen değişiklikler Pages derlemesi başarıyla bittiğinde canlı siteye yansır. Siteyi kullanmak için yerel sunucu veya ev bilgisayarının açık olması gerekmez.
- Firebase giriş ve veri işlemleri aynı bulut projesini kullanır. Bu işlem Firebase kurallarını değiştirmez.
- Yayın kontrolü giriş ekranı, kullanıcı seçenekleri ve statik kaynakların yüklenmesini kapsar; hesapla giriş ve yetkili veri işlemleri ayrıca denenmelidir.

## Mevcut durum

- Uygulamanın 46 dosyalık ilk aktarımı tamamlandı. Aktarım commit'i: 8382f4d.
- Baslat.bat önceden eksik scripts/Baslat.ps1 dosyasını çağırıyordu. AVG karantina ekranında Baslat.ps1 için IDP.Generic tespiti görüldü; tespiti hangi komutun tetiklediği doğrulanmadı.
- PowerShell başlatıcısı kaldırıldı. Baslat.bat artık py -3 scripts/baslat.py çalıştırıyor; ExecutionPolicy Bypass kullanılmıyor.
- Python başlatıcı 127.0.0.1:8765 üzerinde standart bir HTTP sunucusu açar ve varsayılan tarayıcıyı başlatır. Aynı uygulama zaten çalışıyorsa mevcut sunucuyu kullanır. Yeni sunucu çalışırken terminal penceresi açık kalmalıdır.
- Yeni sunucunun index.html içeriğini doğru sunduğu ve mevcut sunucu üzerinden tekrar açılış doğrulandı. AVG'nin yeni başlatıcıyı tekrar karantinaya almayacağı garanti edilmedi; değişiklik sonrası AVG sonucu henüz kullanıcı tarafından doğrulanmadı.
- README.md çalıştırma ve Git kullanımını anlatır. .gitignore logları, önbelleği, özel anahtarları ve kaynak veri dosyalarını dışarıda bırakır.

## Teknik yapı

- index.html: ana arayüz ve uygulama mantığının bir bölümü.
- js/: Firebase istemcisi, kullanıcı yetkileri, dönem yönetimi, öğrenci/personel modülleri ve raporlar.
- css/, assets/, vendor/: tasarım, görseller ve dağıtıma dahil kütüphaneler.
- config/firebase-config.js: tarayıcıda kullanılan herkese açık Firebase istemci tanımlayıcıları.
- config/firestore.rules ve config/firebase.json: Firebase yapılandırma kaynakları. GitHub'a gönderim bunları Firebase'e otomatik yayımlamaz.
- Uygulama verileri Firebase'dedir; GitHub deposu bulut verilerinin yedeği değildir.

## Başka bilgisayarda devam

1. Git ve Python 3 kurulu olmalı (Windows'ta py -3 çalışmalı).
2. İlk kullanımda depoyu klonlayın: git clone https://github.com/ozbinici07/brifing.git
3. Codex'te indirilen brifing klasörünü proje olarak açın.
4. Yeni sohbette: “Önce AGENTS.md ve docs/PROJE_NOTLARI.md dosyalarını oku, projeye kaldığımız yerden devam edeceğiz.”
5. Sonraki çalışmalardan önce yerel değişiklikleri kontrol edin ve git pull --ff-only ile güncelleyin. Çakışmaları veya ayrışmış geçmişi zorla sıfırlamayın.
6. Baslat.bat ile uygulamayı açın. Firebase için internet gerekir.
7. İş sonunda doğrulama yapın, bu notları güncelleyin ve commit/push sonucunu kontrol edin. Bağlı GitHub aracıyla da gönderim yapılabilir; tarayıcıda giriş yapılması yerel Git kimlik doğrulamasını otomatik sağlamaz.

## Kalan işler

- İş bilgisayarında depo ilk kez açılıp çalıştırılacak.
- Yeni başlatıcının AVG tarafından tekrar engellenip engellenmediği kullanıcıdan gelecek sonuca göre değerlendirilecek.
- Henüz belirtilmiş yeni bir uygulama özelliği veya başka bir açık geliştirme görevi yok.

Bu dosyaya kişisel bilgiler, şifreler veya sohbetin tamamını eklemeyin; yalnızca proje için gerekli teknik durum ve kararları kaydedin.
## 29 Ekim 2026 — Logo ve çalışma kuralları
- Kullanıcının Muğla BBS rozeti assets/bbs-logo.png olarak GitHub’a eklendi; CSS ve genel bakış başlığı güncellendi.
- index.html üst başlık, favicon ve apple-touch-icon aynı görsele bağlandı (0e1fc24). Eski amblemi içeren giriş arka planı yerine mevcut Bodrum panoraması kullanıldı.
- GitHub araç bağlantısı kullanılamadığı için değişiklikler yetkili GitHub tarayıcı oturumundan kaydedildi.
- AGENTS.md doğrudan GitHub’da güncellendi (9dcf8fa): değişiklikler GitHub’da yapılacak, her iş proje notlarına yazılacak, tercih/kurallar değiştiğinde AGENTS.md güncellenecek ve canlı yayın doğrulanmadan tamamlandı denmeyecek.
- Otomatik Firebase yayını ve canlı görünüm bu kayıt sonrasında kontrol edilecek; henüz doğrulanmış sayılmamalı.
- Sonuç: Logo yayını başarıyla tamamlandı: https://github.com/ozbinici07/brifing/actions/runs/40914391176 . Canlı giriş ekranında yeni BBS rozeti ve favicon/apple-touch-icon bağlantıları doğrulandı.
## 29 Ekim 2026 — Arka planın geri alınması ve PWA
- Logo isteği sırasında kapsam dışı değiştirilen giriş arka planı kullanıcının düzeltmesi üzerine eski mugla-login-background.png görseline geri alındı. Yeni BBS logosu korundu. Kullanıcı istemedikçe arka plan veya diğer tasarım alanları değiştirilmemelidir.
- PWA için manifest.webmanifest, sw.js ve js/pwa.js GitHub’da oluşturuldu. Uygulama adı Brifing Bilgi Sistemi, kısa adı Muğla BBS, görüntüleme standalone ve simgesi yeni rozettir.
- Tarayıcı beforeinstallprompt olayını destekleyip uygun gördüğünde giriş ekranında Uygulamayı yükle düğmesi görünür. iOS kendi Ana Ekrana Ekle akışını kullanır.
- Servis çalışanı ağ üzerinden çalışır; Firebase verileri veya oturum bilgileri önbelleğe alınmaz. Çevrimdışı açılışta internet gerektiğini bildiren ekran gösterir.
- scripts/build-hosting.mjs manifest ve servis çalışanını Firebase paketine ekler ve PWA istemcisini yayımlanan HTML’e bağlar.
- Yayın başarıyla tamamlandı: https://github.com/ozbinici07/brifing/actions/runs/40916849612 . Canlı sayfada özgün arka plan, manifest bağlantısı ve PWA scripti doğrulandı. Gerçek cihazda kurulum son kullanıcı tarafından ayrıca denenmelidir.
## 30 Ekim 2026 — Seçilen giriş arka planı
- assets/ChatGPT Görseli 29 Eki 2026 20_16_21.png giriş ekranına center top/cover olarak bağlandı; index.html ön yüklemesi aynı görsele güncellendi.
- Değişiklikler Burak hesabının yetkili GitHub tarayıcı oturumundan doğrudan main dalına kaydedildi: a352e56 ve c480c8b. Yerel kopya yalnızca kaydedilmiş GitHub kaynaklarını test etmek için kullanıldı.
- Doğrulama: node scripts/build-hosting.mjs başarılı; paket içindeki son CSS kuralı, ön yükleme adresi ve görselin varlığı kontrol edildi. CRLF satır sonları dikkate alınarak git diff --check başarılı.
- Firebase otomatik yayınları başarılı: https://github.com/ozbinici07/brifing/actions/runs/40961454322 ve https://github.com/ozbinici07/brifing/actions/runs/40961523544 .
- Canlı https://brifingbilgisistemi.web.app/ Chrome tarayıcıda yenilendi; seçilen arka planın görünümü, hesaplanan CSS adresi ve ön yükleme bağlantısı doğrulandı. Canlı CSS HTTP 200.
- Bu iş kapsamında bilinen sorun veya kalan iş yok. Hesapla giriş testi yapılmadı; Firebase verileri ve kuralları değiştirilmedi.
## 30 Ekim 2026 — Giriş arka planını hızlandırma
- Özgün 1672×940 PNG korunarak aynı çözünürlükte WebP (quality 85, method 6) sürümü assets/login-background-v2.webp olarak eklendi. Dosya 1.704.245 bayttan 91.432 bayta indi (%94,6 azalma).
- Son giriş CSS kuralı WebP dosyasına bağlandı; ön yükleme HTML başına taşındı ve fetchpriority="high" verildi. CSS sürümü v10 yapıldı.
- Değişiklikler uygulama içi GitHub tarayıcı oturumundan main dalına kaydedildi: 8ee01d4, 96649ea ve 6d71240.
- Testler: Hosting paketi başarıyla oluşturuldu; çözünürlük eşitliği, paket görseli, CSS adresi, erken ön yükleme ve CRLF uyumlu diff kontrolü geçti.
- Firebase yayını başarılı: https://github.com/ozbinici07/brifing/actions/runs/40962357126 . Canlı giriş ekranında WebP arka planı ve yüksek öncelikli ön yükleme tarayıcıda doğrulandı.
- Süre kazanımı bağlantıya göre değişir; sabit bir hız çarpanı ölçülmedi. Bu iş için kalan sorun yok; Firebase verileri ve kuralları değiştirilmedi.
## 30 Ekim 2026 — Ortak başlık, sol menü ve üst bilgiler
- js/compact-layout.js tüm uygulama betiklerinden sonra yüklenir. Büyük BBS logosu menülerin üstüne taşındı; altına “Muğla İl Millî Eğitim Müdürlüğü · Brifing Bilgi Sistemi” yazıldı, yan menü sürümü kaldırıldı. Üst solda yalnızca uygulama logosu ve adı kaldı.
- Dönem seçici ve veri durumu / son güncelleme / dönem sayısı / yenileme alanları üst bara taşındı. Genel Bakış içindeki eski durum satırı kaldırıldı. Yinelenen oturum yazısı ve bildirim sayısı gizlendi; arama, bildirim zili ve admin bilgisi korundu. Çıkış en sağa taşındı. Mevcut kontrol kimlikleri ve olayları korunur; görünür dönem seçici özgün dönem kilidini izler.
- Genel Bakış ve diğer ana sekmeler 64px yüksekliğinde açık mavi dalga/ağ desenli vektör başlık kullanır. Yalnızca sayfa başlığı ve Türk bayrağı görünür. Kurum alt başlığı, başlık logosu, fotoğraf ve Atatürk alıntısı kaldırıldı. Rapor düğmeleri başlığın altında korundu; başlangıçta gizli birim başlıkları da ortak düzeni alır.
- Kullanıcının ek düzeltmesi: üstteki moduleDataStatus uyarısı gizlendi; aşağıdaki boş-veri uyarısı 16px yazı ve hafif kırmızı arka planla tam genişlikte gösterilir (e24681f).
- Doğrulama: JS ve iki HTML içi betiğin sözdizimi, Hosting paketi ve CRLF uyumlu diff kontrolü geçti. Canlıda Genel Bakış, Öğrenci, Okul/Kurum, Öğretmen, Yönetici, Personel ve Yönetici Paneli başlıkları ve bayrakları kontrol edildi. Öğrenci başlığındaki altı rapor düğmesi korundu. 1024px ve 390px ekran genişliklerinde üst alan yatay taşmıyor. Dönem seçimi ve yenileme denendi; son seçim Ekim 2026.
- İlk etkinleştirmede betik bağlantısı yanlışlıkla rapor HTML şablonuna girmişti; c583ec0 ile ana belgenin sonuna taşındı. Açılış ve oturum tekrar doğrulandı; kaynakta tek script bağlantısı olduğu kontrol edildi.
- Firebase arayüz yayını c583ec0 için başarılı ve canlı oturumda doğrulandı. Son uyum yayını: https://github.com/ozbinici07/brifing/actions/runs/40965183814 . Kaynak veri dosyaları ve Firestore kuralları değiştirilmedi.
### Üst çubuk ve boş-veri uyarısı ek düzeltmeleri
- Üstte yinelenen boş-veri mesajının gizlendiği ve alttaki mesajın 16px / rgb(255,240,242) olarak göründüğü canlı Okul/Kurum ekranında doğrulandı. e24681f Firebase yayını başarılı.
- ff7e2b0 ile üst durum etiketleri ve değerleri yan yana tek satır yapıldı; admin / Yönetici aynı satıra alındı. Üst çubuğun minimum yüksekliği 64px yerine 48px oldu. Zile “Bildirimler” etiketi eklendi.
- Sözdizimi, Hosting paketi ve diff kontrolü başarılı. Bu ek kaydın ardından otomatik yayın ve canlı üst çubuk son kez kontrol edilir.
### Kullanıcı alanı, dönem ve düğme görünümü
- Kullanıcı yazısı 13px, rol 12px yapıldı; A simgesi CSS sıralamasıyla yazının sağına alındı. Birim oturumundaki dinamik etiket güncellemesi için DOM komşuluğu korundu. Dekoratif ayarlar simgesi kaldırıldı (7caab21).
- Veriyi Yenile 28px yüksekliğe ve 6px yatay boşluğa daraltıldı. Aktif Dönem alanı ve seçicisi hafif kırmızı zemine alındı (e961714); dönem adları kalınlaştırıldı (d8dba5a).
- Çıkış düğmesi kırmızı zemin, beyaz 12px kalın yazı, belirgin kenarlık ve klavye odak çerçevesiyle güncellendi. Sağdaki konumu korundu.
- Değişiklikler GitHub tarayıcı oturumunda kaydedildi. Sözdizimi, Hosting paketi ve diff kontrolleri çalıştırılır; son gönderim sonrası Firebase Actions ve canlı tarayıcı görünümü doğrulanır.
- Ek düzeltme (654c691): sol logo altındaki kurum / uygulama adı arasındaki orta nokta kaldırıldı. Güncel yazı: “Muğla İl Millî Eğitim Müdürlüğü Brifing Bilgi Sistemi”. Sözdizimi, Hosting paketi ve diff kontrolü başarılı.
- Ek hizalama (0b2bed9): Okul/Kurum Bilgi Tabloları ve Bilgi Sorgulama sekmeleri aynı sistem kökü içinde ekran raporu araçlarının satırına taşındı; solda sekmeler, sağda rapor araçları yer alır. Dar ekranlarda satır kırılabilir; mevcut sekme olayları korunur.
- Canlı üst çubuk kontrolünde A simgesi yazının sağında, kullanıcı yazısı 13px, dönem yazısı 700 kalınlıkta, dönem arka planı rgb(255,240,242), yenileme yüksekliği 28px ve Çıkış kırmızı olarak doğrulandı. Ayarlar simgesi ve logo altı orta nokta yok.
- Öğrenci Bilgi Sistemi tablo/sorgulama sekmeleri de aynı rapor araçları satırına alındı (291bebb). Okul/Kurum sayfasındaki ortak satır ve sorgulama sekmesi canlıda doğrulandı. Sözdizimi, paket ve diff kontrolleri başarılı; son öğrenci görünümü Firebase yayını sonrası kontrol edilir.

## 30 Ekim 2026 — Üstteki yinelenen logo ve yazının kaldırılması
- Kullanıcının ikinci görseline göre üst çubuktaki küçük BBS logosu ve Brifing Bilgi Sistemi yazısı kaldırıldı. Büyük yan menü logosu ve kurum adı korundu.
- Sol menü ekranın üstünden başlayacak şekilde iki grid satırına yayıldı; logo üst boşluğu referans görsele göre düzenlendi. Üst çubuk sağ içerik sütununa alındı; dar ekran arama yerleşimi güncellendi.
- GitHub ve tarayıcı araçları kullanılamadığından, kullanıcının “uygula” talimatıyla güncel origin/main kopyasında değişiklik hazırlanıp Git üzerinden gönderim yolu kullanıldı.
- Doğrulama: node --check js/compact-layout.js, Hosting paketleme ve git diff --check başarılı.
- GitHub kaydı: d463344. Firebase otomatik yayını başarılı: https://github.com/ozbinici07/brifing/actions/runs/41018300255 . Canlı js/compact-layout.js HTTP 200; yayımlanan içerik gönderilen kaynakla birebir aynı, küçük başlığı kaldıran işlem ve sol menü grid kuralları doğrulandı. Oturum içi görsel kontrol tarayıcı aracı olmadığı için yapılmadı; Firebase verileri ve kuralları değiştirilmedi.

## 30 Ekim 2026 — Yan menü logosunun yukarı taşınması
- Kullanıcının ekran görüntüsü üzerine yan menünün üst boşluğu 82px yerine 38px yapıldı. Logo, kurum adı ve menü bağlantıları 44px yukarı taşınır.
- Doğrulama: JavaScript sözdizimi, Hosting paketi ve diff kontrolü başarılı. Yayın sonucu gönderim sonrası kontrol edilir; oturum içi görsel kontrol yapılmadı.

- Kullanıcının ek isteği: büyük logo masaüstünde 126px yerine 142px, kurum yazısı 11px yerine 12px yapıldı. Dar ekran logo boyutları 114px / 96px, yazıları 11px / 10px olarak orantılı büyütüldü. 38px üst boşluk korundu.

- Yayın sonucu: 221d09f Firebase yayını başarılı: https://github.com/ozbinici07/brifing/actions/runs/41018605359 . Canlı JS HTTP 200 ve gönderilen kaynakla birebir eşleşiyor; 38px üst boşluk, 142px logo ve 12px kurum yazısı yayımlandı. Oturum içi görsel kontrol yapılmadı.


## 30 Ekim 2026 — Öğretmen ve yönetici araç satırı
- Öğretmen Bilgi Tabloları / Bilgi Sorgulama ve Yönetici Bilgi Tabloları / Bilgi Sorgulama sekmeleri, ilgili Ekran Görüntüsü ve rapor düğmeleriyle aynı araç satırına taşındı. Mevcut okul/öğrenci düzeni bu iki modüle de uygulandı; sekmeler solda, rapor araçları sağda. Dar ekranda satır kırılabilir; olay dinleyicileri korunur.
- Doğrulama: JS sözdizimi, Hosting paketi ve diff kontrolü başarılı. Yayın ve canlı kaynak kontrolü gönderim sonrası yapılır; oturum içi görsel kontrol yapılmadı.

- Yayın sonucu: a7eee1e Firebase yayını başarılı: https://github.com/ozbinici07/brifing/actions/runs/41018826007 . Canlı js/compact-layout.js HTTP 200 ve kaynakla birebir eşleşiyor; öğretmen/yönetici seçicileri yayımlandı. Oturum içi görsel kontrol henüz yapılmadı. Bu sonuç kaydı yalnızca belge değişikliğidir.


## 30 Ekim 2026 — Mavi ağ desenli paneller ve personel menüsü
- Kullanıcının referansına göre sol menü ve üst çubuk koyu mavi geçişli, çokgen/ağ desenli ortak assets/panel-network.svg arka planını kullanır. Sayfa başlık şeridi aynı mavi palete alındı; başlık ve üst çubuk metinleri beyaz, yenileme düğmesi mavi yapıldı.
- Personel Hizmetleri menü sekmesi CSS ile tüm oturumlarda gizlendi; dinamik yetki güncellemeleriyle tekrar görünmez. Personel kayıtları ve birim veri işlevleri silinmedi.
- JS sözdizimi, Hosting paketi ve diff kontrolü başarılı. Yayın ve canlı kaynak doğrulaması gönderim sonrası yapılır; oturum içi görsel kontrol yapılmadı.

- Ek kullanıcı isteği: üst ve sol alanın tek parça görünmesi için desen .app üzerinde tek arka plan olarak çizilir. Üst çubuk ve sol menü saydamdır; aralarındaki kenarlık ve üst gölge kaldırıldı.

- Yayın sonucu: 98797c1 Firebase yayını başarılı: https://github.com/ozbinici07/brifing/actions/runs/41022281695 . Canlı JS ve panel-network.svg HTTP 200; JS gönderilen kaynakla birebir aynı. Ortak arka plan ve personel menüsünü gizleme kuralı yayımlandı. Oturum içi görsel kontrol yapılmadı; bu son kayıt yalnızca belge değişikliğidir.


## 30 Ekim 2026 — Başlık şeridinin ortak yüzeye birleştirilmesi
- Kullanıcının canlı ekran görüntüsünde başlık bandının ayrı arka planı ve içerik kenarındaki açık renk boşluk bütünlüğü bozuyordu. Başlık bandı saydam ve köşesiz yapıldı, iki yandaki 14px iç boşluğa taşırıldı. İçerik arka planının ilk 64px alanı saydamlaştırıldı; ortak .app deseni artık üst çubuk, başlık ve sol menü boyunca tek yüzeyde görünür.
- JS sözdizimi, Hosting paketi ve diff kontrolü başarılı. Oturum içi görsel kontrol yapılmadı; yayın sonucu gönderim sonrası kontrol edilir.

- Ek düzeltme: Aktif Dönem alanının pembe zemini kaldırıldı; beyaz zemin, koyu yazı ve çerçevesiz beyaz seçici uygulandı. Başındaki dekoratif ▦ simgesi kaldırıldı; dönem seçimi ve kilit davranışı korundu.

- Yayın sonucu: ff421c1 Firebase yayını başarılı: https://github.com/ozbinici07/brifing/actions/runs/41022576910 . Canlı JS HTTP 200 ve kaynakla birebir aynı. Ortak başlık arka planı ve beyaz dönem alanı yayımlandı. Oturum içi görsel kontrol yapılmadı.


## 30 Ekim 2026 — Genel Bakış başlığının üst çubuğa taşınması
- Genel Bakış başlığı hızlı aramanın soluna alındı; yalnızca Genel Bakış açıkken görünür. Ayrı 64px başlık bandı gizlenerek içerik yukarı alındı. Diğer sayfaların başlıkları korundu; sağdaki dekoratif Türk bayrakları kaldırıldı.
- Dar ekranda başlık ve arama aynı grid satırındadır. JS sözdizimi, Hosting paketi ve diff kontrolü başarılı; yayın sonucu gönderim sonrası kontrol edilir. Oturum içi görsel kontrol yapılmadı.

- Yayın sonucu: 4a7c6b9 Firebase yayını başarılı: https://github.com/ozbinici07/brifing/actions/runs/41023477035 . Canlı JS HTTP 200 ve gönderilen kaynakla birebir aynı. Oturum içi görsel kontrol yapılmadı.


## 30 Ekim 2026 — Tüm sekmelerde ortak üst başlık ve eşit kontroller
- Kullanıcının düzeltmesiyle tüm sayfa başlıkları hızlı aramanın solundaki ortak başlıkta gösterilir; etkin sekme değişince başlık güncellenir. Ayrı başlık bantları kapatıldı ve içerik üst boşluğu tüm sekmelerde daraltıldı.
- Hızlı arama, Veriyi Yenile, Aktif Dönem ve Çıkış 180×34px ortak ölçüye, 6px köşe yarıçapına ve eşit iç boşluğa alındı. Dar ekranda ortak genişlik 150px olur. Avatar 34px yüksekliğe eşitlendi.
- JS sözdizimi, Hosting paketi ve diff kontrolü başarılı. Oturum içi görsel kontrol yapılmadı; otomatik yayın ve canlı kaynak kontrolü gönderim sonrası yapılır.

- Yayın sonucu: 6aced56 Firebase yayını başarılı: https://github.com/ozbinici07/brifing/actions/runs/41023866083 . Canlı JS HTTP 200 ve kaynakla birebir eşleşiyor. Oturum içi görsel kontrol yapılmadı.


## 30 Ekim 2026 — Düğme genişliği ve Genel Bakış başlık düzeltmesi
- Kullanıcının açıklaması: eşitlik yükseklikte isteniyor. Çıkış ve Veriyi Yenile düğmelerinin sabit 180px genişliği kaldırıldı; içerik kadar dar genişlik ve 34px ortak yükseklik korundu.
- Genel Bakış başlığı sayfa içindeki gizli birim başlığından alınıyordu. overview sayfasında ortak üst başlık artık her zaman yalnızca Genel Bakış gösterir.
- JS sözdizimi, Hosting paketi ve diff kontrolü başarılı. Yayın sonucu gönderim sonrası kontrol edilir; oturum içi görsel kontrol yapılmadı.

- Ek kullanıcı düzeltmesi: üst çubuktaki responsive iki satırlı grid kaldırıldı. Tüm sekmelerde başlık, esnek genişlikli arama, durum bilgileri ve düğmeler nowrap flex satırında yan yana kalır. Çok dar ekranda üst çubuk yatay kaydırılabilir; öğeler ikinci satıra düşmez. Çubuk minimum yüksekliği 44px.

- Yayın sonucu: 4e7f81e Firebase yayını başarılı: https://github.com/ozbinici07/brifing/actions/runs/41024407268 . Canlı JS HTTP 200 ve gönderilen kaynakla birebir eşleşiyor. Genel Bakış başlığı, dar düğmeler ve tek satır düzeni yayımlandı. Oturum içi görsel kontrol yapılmadı.


## 30 Ekim 2026 — Aramanın bildirim yanına taşınması
- Hızlı arama mevcut DOM öğesi korunarak sağdaki işlem grubunda Bildirimler'in hemen soluna taşındı. Sol alan etkin menü adına ayrıldı. Ortak 34px yükseklik ve tek satır düzeni korundu; arama genişliği 160px.
- JS sözdizimi, Hosting paketi ve diff kontrolü başarılı. Yayın sonucu gönderim sonrası kontrol edilir; oturum içi görsel kontrol yapılmadı.

- Ek kullanıcı isteği: üst çubuk minimum yüksekliği 44px yerine 58px, dikey iç boşluğu 10px yapıldı. Başlık, işlem grubu ve durum öğeleri dikey ortalanır; 34px kontrol yüksekliği ve tek satır düzeni korunur.

- Yayın sonucu: 4a42320 Firebase yayını başarılı: https://github.com/ozbinici07/brifing/actions/runs/41024717327 . Canlı JS HTTP 200 ve gönderilen kaynakla birebir aynı. Arama bildirim yanında, üst çubuk 58px ve içerikleri dikey ortalı. Oturum içi görsel kontrol yapılmadı.


## 30 Ekim 2026 — Hızlı Bilgi satırının daraltılması
- Genel Bakış Hızlı Bilgi panelinde başlık ve dört bilgi tek satıra alındı. Etiketler ve değerler yan yana; iç kartların çerçevesi ve büyük boşlukları kaldırıldı. Panel minimum yüksekliği 48px; dar ekranda yatay kaydırılır. Mevcut veri kimlikleri korunur.
- JS sözdizimi, Hosting paketi ve diff kontrolü başarılı. Yayın sonucu gönderim sonrası kontrol edilir; oturum içi görsel kontrol yapılmadı.


## 30 Ekim 2026 — Sorgulamada ekran raporu grubunun gizlenmesi
- Okul/Kurum ve Öğrenci sorgulama sekmesi etkin olduğunda üst araç satırındaki Ekran Görüntüsü etiketi ve Yazdır/PDF/Excel grubu gizlenir. Öğrenci ayırıcı çizgisi de gizlenir. Tablo sekmesine dönüşte grup yeniden görünür; tüm verilerin ve sorgu sonuçlarının rapor araçları korunur.
- Etkin sekme sınıflarına bağlı CSS kullanıldı; olay dinleyicileri değiştirilmedi. JS sözdizimi, Hosting paketi ve diff kontrolü başarılı. Yayın sonucu gönderim sonrası kontrol edilir; oturum içi görsel kontrol yapılmadı.

- Ek istek: öğrenci sorgulama özetindeki sekiz kutu tek satırda sekiz sütuna alındı. Etiket ve değer arasında boşluk bırakıldı, kutular 42px minimum yüksekliğe daraltıldı. Dar ekranda satır kırmak yerine yatay kaydırılır.

- Yayın sonucu: 6a83298 Firebase yayını başarılı: https://github.com/ozbinici07/brifing/actions/runs/41025500888 . Canlı JS HTTP 200 ve kaynakla birebir aynı; son kaynak Hızlı Bilgi satırı, sorgulamada ekran raporu gizleme ve sekizli öğrenci özeti düzenlemelerini içerir. Oturum içi görsel kontrol yapılmadı.


## 30 Ekim 2026 — Sütun seçiminin filtrelere taşınması
- Öğrenci sorgulamada Filtre Kullanımı bölümü kaldırıldı. Sütunlar — Göster / Gizle mevcut kutuları ve olayları korunarak filtre ızgarasında çoklu seçim açılır alanına taşındı. Diğer listeler gibi dışarı tıklanınca kapanır. Masaüstünde filtreler altı sütun; rapor düğmeleri altta sağda korunur.
- JS sözdizimi, Hosting paketi ve diff kontrolü başarılı; oturum içi görsel kontrol yapılmadı. Yayın sonucu gönderim sonrası kontrol edilir.

- Yayın sonucu: c54262c Firebase yayını başarılı: https://github.com/ozbinici07/brifing/actions/runs/41025682930 . Canlı JS HTTP 200 ve gönderilen kaynakla birebir aynı. Oturum içi görsel/etkileşim kontrolü yapılmadı.


## 30 Ekim 2026 — Sorgu düğmeleri ve sıralama konumu
- Öğrenci sorgulamadaki ters sıralama kutusu kaldırıldı; mevcut Sıralama açılır listesi Excel düğmesinin sağına taşındı. Liste öğrenci sayısı artan/azalan, ad A-Z/Z-A ve ilçe A-Z seçeneklerini korur; mevcut onchange ve varsayılan sıralama korunur.
- Sorgula ve Filtreleri Temizle mevcut öğeleriyle filtre ızgarasında Sütunlar alanının yanına taşındı. Masaüstünde ikinci satırda yan yana görünürler.
- JS sözdizimi, Hosting paketi ve diff kontrolü başarılı. Oturum içi görsel kontrol yapılmadı; yayın sonucu gönderim sonrası kontrol edilir.

- Yayın sonucu: 6ebd54b Firebase yayını başarılı: https://github.com/ozbinici07/brifing/actions/runs/41026226157 . Canlı JS HTTP 200 ve gönderilen kaynakla birebir aynı. Oturum içi görsel/etkileşim kontrolü yapılmadı.


## 30 Ekim 2026 — Sorgu raporlarının işlem satırına alınması
- Öğrenci sorgulamada Yazdır, PDF, Excel ve sıralama listesi mevcut öğeleriyle Sorgula / Filtreleri Temizle grubunun sağına taşındı. Masaüstünde aynı filtre satırındadır; ortak kontrol yüksekliği 38px. Boş kalan alt satır gizlendi. Dar ekranda işlem satırı kırılabilir.
- JS sözdizimi, Hosting paketi ve diff kontrolü başarılı; oturum içi görsel kontrol yapılmadı. Yayın sonucu gönderim sonrası kontrol edilir.

- Yayın sonucu: ca4a70d Firebase yayını başarılı: https://github.com/ozbinici07/brifing/actions/runs/41026594875 . Canlı JS HTTP 200 ve gönderilen kaynakla birebir aynı. Boş alt satır kuralı HTML içindeki boşluk metinlerini de dikkate alır. Oturum içi görsel/etkileşim kontrolü yapılmadı.


## 30 Ekim 2026 — Referansa göre giriş ekranı
- Giriş ekranı açık mavi, beyaz ve koyu mavi dalgalı SVG arka plan, büyük mevcut BBS logosu, açık renk kart, koyu mavi başlık ve kırmızı Giriş Yap düğmesiyle yenilendi. Referansın arka planı vektör dalgalarla uyarlandı; bina fotoğrafı yeniden oluşturulmadı. Eski arka plan dosyası korundu, erken ön yükleme yeni SVG'ye alındı.
- css/login-design.css ve js/login-design.js eklendi. Şifre göster/gizle düğmesi erişilebilir etiket ve basılı durumu kullanır. Mevcut kullanıcı seçimi, hatırlama, şifre yenileme yönlendirmesi ve giriş kimlikleri korundu. Alt özellik kartları gizlendi, sürüm bilgisi korundu.
- Doğrulama: iki HTML içi script ve yeni JS sözdizimi, Hosting paketi ve CRLF uyumlu diff kontrolü başarılı. Yerel Chrome headless 1440×1000 görüntüsü incelendi. Dar ekran genişliği viewport ile sınırlandı; gerçek cihaz ve hesapla giriş denenmedi. Yayın sonucu gönderim sonrası kontrol edilir.

- Yayın sonucu: 8d8596a Firebase yayını başarılı: https://github.com/ozbinici07/brifing/actions/runs/41055048139 . Canlı HTML ve CSS HTTP 200, CSS kaynakla eşleşiyor; yeni script ve stil bağlantıları doğrulandı. Canlı giriş ekranı Chrome headless 1440×1000 görüntüsünde kontrol edildi. Hesapla giriş yapılmadı; Firebase verileri ve kuralları değiştirilmedi.


## 30 Ekim 2026 — Giriş arka planının geri yüklenmesi
- Kullanıcı yalnızca giriş kartının düzenlenmesini istemişti; kapsam dışı değiştirilen arka plan önceki login-background-v2.webp görseline center top/cover olarak geri alındı. Erken ön yükleme ve ilk arka plan rengi eski değerlerine döndü. Yeni kart düzeni korundu; giriş stili sürümü v2 yapıldı.
- Kullanıcı istemedikçe giriş arka planı değiştirilmemelidir. JS/HTML sözdizimi, Hosting paketi ve CRLF uyumlu diff kontrolü başarılı; yayın sonucu gönderim sonrası kontrol edilir.

- Yayın sonucu: 6641665 Firebase yayını başarılı: https://github.com/ozbinici07/brifing/actions/runs/41055317290 . Canlı CSS HTTP 200; eski WebP arka plan adresi doğrulandı. Chrome headless 1440×1000 canlı ekranında önceki Türk bayraklı arka planın geri geldiği ve yeni kartın korunduğu görsel olarak kontrol edildi.


## 30 Ekim 2026 — Logo yükleme hızlandırması
- 1254×1254 RGBA logo PNG'si 2.242.949 bayttı. Özgün dosya korunarak 512×512 saydam WebP (quality 92) 108.712 bayt üretildi (%95,2 küçülme). Giriş ve uygulama logoları WebP'ye bağlandı, HTML başında yüksek öncelikli ön yükleme eklendi.
- Favicon/apple-touch-icon için 192×192 PNG 85.606 bayt üretildi; bu alanlarda da büyük özgün PNG'nin gereksiz indirilmesi önlendi. Giriş ve referans stil sürümleri güncellendi. Arka plan değiştirilmedi.
- JS sözdizimi, Hosting paketi ve CRLF uyumlu diff kontrolü başarılı. Yayın ve canlı dosya doğrulaması gönderim sonrası kontrol edilir; gerçek ağda sabit hız kazancı ölçülmedi.

- Ek kullanıcı isteği: Giriş Yap düğmesindeki ok kaldırıldı; yazı yatay/dikey ortalandı. Giriş stili sürümü v4 yapıldı. Hosting paketi ve CRLF uyumlu diff kontrolü başarılı.

- Kullanıcının açık isteğiyle Şifremi Unuttum mesajına sistem yöneticisinin adı Burak ÖZBİNİCİ eklendi; teknik Firebase açıklaması yerine iletişim yönlendirmesi gösterilir. Referans UI betiği sürümü v5. JS sözdizimi, Hosting paketi ve CRLF uyumlu diff kontrolü başarılı.

- Kullanıcı isteği: giriş durum metni Sisteme bağlanıp giriş yapılıyor... olarak değiştirildi; giriş hata mesajındaki Firebase ön eki kaldırıldı. İstemci betik sürümü period-v27 yapıldı. Kimlik doğrulama mantığı değiştirilmedi; JS sözdizimi, Hosting paketi ve CRLF uyumlu diff kontrolü başarılı.

- Toplu yayın doğrulaması: 4de2a28 yayını başarılı: https://github.com/ozbinici07/brifing/actions/runs/41055943320 . Canlı istemcide yeni giriş metni, referans UI'da yönetici adı ve Firebase açıklamasının kaldırılması, HTML'de oksuz Giriş Yap düğmesi ve 108.712 bayt WebP logo doğrulandı. Hesapla giriş yapılmadı.


## 30 Ekim 2026 — Kullanıcının yeni BBS logosu
- Kullanıcının sağladığı yeni logo.jpeg giriş, sol menü, başlık logoları, favicon/apple-touch-icon ve PWA simgesine uygulandı. Arka plan ve diğer tasarım alanları değiştirilmedi.
- 512px WebP logo 51.588 bayt; 192px PNG tarayıcı simgesi 56.112 bayt; 512px PNG PWA simgesi 280.237 bayt. Yeni dosya adları ve stil/betik sürümleri eski önbelleklerin kullanılmasını önler. Yuvarlak logo alanları dairesel gösterilir; erken logo ön yüklemesi korunur.
- JS sözdizimi, Hosting paketi, manifest JSON ve CRLF uyumlu diff kontrolü başarılı. Yayın ve canlı görüntü doğrulaması gönderim sonrası yapılır; kurulu PWA simgesi işletim sisteminin yenileme zamanına bağlıdır.

- Yayın sonucu: 268eb08 Firebase yayını başarılı: https://github.com/ozbinici07/brifing/actions/runs/41056918429 . Canlı WebP HTTP 200 ve 51.588 bayt; manifest yeni 512px simgeyi gösteriyor. Canlı Chrome headless 1440×1000 giriş görüntüsünde yeni logo ve değişmeyen arka plan doğrulandı. Oturum içi sol menü ayrıca açılmadı; kaynak bağlantısı yeni WebP'ye güncellendi.
