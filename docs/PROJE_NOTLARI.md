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
