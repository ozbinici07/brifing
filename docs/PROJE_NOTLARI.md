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
- Otomatik GitHub → Firebase yayını henüz kurulmadı. Firebase CLI GitHub OAuth oturumu hata verdi, yeni yetkilendirme kullanıcıya iletildi. Yetkilendirme tamamlanmadan otomatik yayın var denmemelidir.
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
