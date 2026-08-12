# Kemborn Sunucu

Kemborn Intercom e-ticaret sitesinin backend'i. Express + PostgreSQL,
ödeme için PayTR Direkt API kullanır.

## Kurulum

```bash
npm install
cp .env.example .env
```

`.env` dosyasını doldur — her değişkenin ne işe yaradığı `.env.example`
içinde satır satır açıklanmış. Yerelde çalıştırmak için asgari olarak
`JWT_SECRET` ve `DB_PASSWORD` gerekir; ödeme ve e-posta olmadan da sunucu
açılır, sadece o özellikler sessizce devre dışı kalır (log'a uyarı yazar).

Veritabanını sıfırdan kur:

```bash
psql -U postgres -f db/schema.sql
psql -U postgres -f db/seed.sql
# db/migrations/ altındaki dosyaları TARİH SIRASIYLA çalıştır
psql -U postgres -f db/migrations/001_pazaryeri_ve_sosyal_medya_urllari.sql
psql -U postgres -f db/migrations/002_misafir_siparis.sql
```

Çalıştır:

```bash
npm run dev
```

Varsayılan port `5005`. `npm run lint` ile ESLint çalıştırılır.

## Klasör yapısı

| Klasör | İçerik |
|---|---|
| `config/` | Ortam değişkenleri, veritabanı bağlantısı, CORS, yükleme limitleri, PayTR ayarları |
| `routes/` | HTTP rotaları — her dosya bir kaynak (`urunler.js`, `siparisler.js`, `kimlik.js`...) |
| `domain/` | İş kuralları: stok, sipariş durumları, şifre kuralı, e-posta/arama doğrulama |
| `middleware/` | Kimlik doğrulama (JWT) ara katmanı |
| `lib/` | Genel yardımcılar: e-posta gönderimi, loglama, para yuvarlama |
| `db/` | `schema.sql` (tam şema), `seed.sql` (örnek veri), `migrations/` (şemadan sonra eklenen değişiklikler, tarih sırasıyla) |
| `scripts/` | Bakım script'leri (aşağıda) |

## Script'ler

- **`scripts/yedek-al.sh`** — production veritabanının yedeğini alır, `pg_restore`
  ile doğrular, son 14 kopyayı tutar. `~/.kemborn-yedek.env` dosyasında bağlantı
  bilgisi bekler (repoda değil, örnek formatı script içinde yazıyor).
- **`scripts/duman-testi.mjs`** — tüm rotaların davranışının değişmediğini
  kanıtlamak için anlık görüntü alır/karşılaştırır. Sunucuda yapısal bir
  değişiklik (dosya bölme, route taşıma) öncesi ve sonrası çalıştırılır.

## Ödeme (PayTR)

Direkt API kullanılıyor — kart bilgisi hiçbir zaman bu sunucuya uğramaz,
tarayıcıdan doğrudan PayTR'ye gider. `PAYTR_TEST_MODE`:

- `1` → test modu, gerçek para çekilmez, PayTR test kartlarıyla denenir
- `0` → canlı mod, gerçek kart gerçekten çekilir

**Canlıya çıkmadan önce `0` olduğunu, test ederken `1` olduğunu kontrol et.**
PayTR panelinde Ayarlar → Bildirim URL'i `https://<backend-adresin>/api/paytr-notify`
olarak ayarlanmalı — bu, koddan değil PayTR panelinden yapılan bir ayar.

## Deploy (Railway)

Bu proje Railway üzerinde çalışıyor. `.env.example`'daki tüm değişkenler
Railway → Variables sekmesinde ayrı ayrı tanımlanmalı (dosya olarak
yüklenmiyor). Railway kredisi biterse hem bu sunucu hem bağlı PostgreSQL
durur — ödeme yöntemi eklenmiş bir plana geçmek gerekir.

## Testler

Kritik iş mantığı (`domain/`, `lib/para.js`) için Vitest testleri var:

```bash
npm test
```

CI, `main`'e her push'ta ve her PR'da bu testleri ve ESLint'i otomatik
çalıştırır (`.github/workflows/ci.yml`).
