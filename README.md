# Brifing Bilgi Sistemi

Firebase Authentication ve Firestore kullanan web uygulaması.

## Yerel çalıştırma

Python 3 ve internet bağlantısı gerekir. Windows'ta `Baslat.bat` dosyasına çift tıklayın. Uygulama `http://127.0.0.1:8765/` adresinde açılır. Sunucu penceresi kullanım boyunca açık kalmalıdır.

Diğer işletim sistemlerinde `python3 scripts/baslat.py` komutunu kullanabilirsiniz.

## Geliştirme

Ana kaynak deposu: https://github.com/ozbinici07/brifing

Başka bilgisayarda ilk kurulum:

```sh
git clone https://github.com/ozbinici07/brifing.git
cd brifing
```

Çalışmaya başlamadan önce `git pull --ff-only` ile son değişiklikleri alın. Değişiklikleri inceleyip commit oluşturun ve GitHub'a gönderin.

Uygulama verileri Firebase'de tutulur; depo bu verilerin yedeği değildir. `config/firebase-config.js` tarayıcı için herkese açık Firebase istemci tanımlayıcıları içerir. Yetkilendirme Firebase Authentication ve Firestore kurallarıyla sağlanır. Özel anahtarları, hesap şifrelerini ve kaynak veri dosyalarını depoya eklemeyin.

`config/firestore.rules` ve `config/firebase.json` Firebase yapılandırma kaynaklarıdır; GitHub'a kod göndermek Firebase kurallarını otomatik yayımlamaz.
