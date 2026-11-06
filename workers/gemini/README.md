# Gemini yorumlayıcısı — Cloudflare Worker

Gemini yalnız Türkçe sorudan yapılandırılmış bir sorgu planı üretir. Sayısal sonuçlar mevcut DataAssistantCore ile gerçek Firestore dönem kaynaklarından hesaplanır; kart, tablo, grafik ve dışa aktarma aynı satırları kullanır. Gemini cevabından hazır istatistik alınmaz.

## Güvenlik
- Worker her POST isteğinde Firebase Authentication backendinde ID token doğrular; proje, kullanıcı kimliği, süre ve iptal sınırını denetler. Canlı unitAccounts kaydında aktif hesap ve data-assistant izni/yönetici rolü gerekir.
- Hesap/şifre/oturum istekleri kapsam dışıdır. Worker Gemini'ye ID token, e-posta, hesap belgesi veya istatistik kayıtları göndermez. Yalnız soru, sorgu planı bağlamı, sütun ve dönem adları gider.
- İstemcide veya GitHub'da Gemini anahtarı bulunmaz. wrangler.jsonc içindeki FIREBASE_WEB_API_KEY zaten web istemcisinde yayımlanan Firebase proje tanımlayıcısıdır; Gemini anahtarı değildir.
- Kaynak veriye erişim ayrıca Firestore kurallarıyla kontrol edilir. Asistan izni salt okunur istatistik kaynakları içindir; kullanıcı yönetimi, diğer hesaplar, şifreler, oturumlar, PDF/Excel ham arşivleri ve yazma izinleri açılmaz.

## Ücretsiz kurulumu tamamlama
1. Cloudflare Workers planını Free, Google AI Studio anahtarının bağlı olduğu projeyi Free tier olarak tutun. Faturalandırma veya ücretli plan açmayın. FREE_TIER_ONLY bayrağı Google/Cloudflare faturalandırma ayarını teknik olarak değiştirmez; hesapların gerçekten ücretsiz olması ayrıca kontrol edilmelidir.
2. Mevcut brifing-gemini Worker için GitHub bağlantısını yalnız ozbinici07/brifing deposuna sınırlayın. Repo adı ile Wrangler name aynı Worker'ı hedeflemelidir. İlgisiz Worker'ları değiştirmeyin.
3. Worker derleme kökü depo kökü; deploy komutu `npx wrangler deploy --config workers/gemini/wrangler.jsonc`. Üretim dalını kurulumda test edilmiş çalışma dalı, tamamlandıktan sonra main olarak seçin. Henüz doğrulanmamış kaynakları main'e birleştirmeyin.
4. Worker > Settings > Variables and Secrets > Add altında Type **Secret**, Name **GEMINI_API_KEY** seçin. Kullanıcı anahtarı kendi ekranında Value alanına girip kaydeder/Deploy eder. Anahtarı sohbete, dosyaya veya ekran görüntüsüne kopyalamayın; değeri yeniden göstermeyin.
5. Wrangler yapılandırması FREE_TIER_ONLY=true ve kamuya açık Firebase web ayarını ekler. ASSISTANT_RATE_LIMITER beş istek/dakika sınırıyla tanımlıdır. Secret ve limiter yoksa Gemini çağrısı yapılmaz.
6. `/health` yalnız yapılandırma durumunu döndürür; gizli anahtar veya hesap verisi döndürmez. Gemini ücretsiz kotası dolunca 429 döner; ücretli model/servis veya otomatik yeniden deneme yoktur. İstemci bunu açıkça belirtip mevcut yerel yorumlayıcıya dönebilir. Kotalar Google projesine göre değişir; sınırsız kullanım vaat edilmez.
7. Firestore kaynak kodu kaydı kural yayını değildir. Yeni asistan okuma kapsamı, güvenlik testlerinden ve gerekli somut onaydan sonra ayrıca yayımlanır. Gerçek kullanıcı kayıtları değiştirilmez.

## Doğrulama ve kapanış
`node --test workers/gemini/worker.test.mjs`, `npm run test:units`, `npm run build:units`, `npm run test:rules` çalıştırılır. Yerel Java eskiyse güvenlik emülatörü GitHub Java 25 CI'de doğrulanır. Anahtar eklendikten sonra canlıda öğrenci, sınıf, yönetici/norm, dönem karşılaştırması ve brifing sorguları; grafik/tablo/kart tutarlılığı, kaynak pencere, asistan-only hesap ve yetki iptali kontrol edilir. Gerçek Gemini çağrısı ve Firebase Hosting doğrulanmadan tamamlandı denmez. Test sonuçları ve kalan işler docs/PROJE_NOTLARI.md'ye yazılır.
