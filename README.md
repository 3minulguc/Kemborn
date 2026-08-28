# Kemborn

Türkiye'de Türk patentiyle üretilen motosiklet interkom sistemlerinin
e-ticaret sitesi.

**Canlı site:** [kemborn.com](https://kemborn.com)

---

## Proje Yapısı

Bu bir monorepo — frontend ve backend ayrı klasörlerde, ayrı ayrı deploy
edilir.

```
Kemborn/
├── kemborn-client/   React + Vite + Tailwind — Vercel'de yayında
└── kemborn-server/   Express + PostgreSQL — Railway'de yayında
```

Her klasörün kendi kurulum talimatı kendi README'sinde:

- [`kemborn-client/README.md`](./kemborn-client/README.md) — frontend kurulumu, ölçümleme (GA4/Meta Pixel) ayarları
- [`kemborn-server/README.md`](./kemborn-server/README.md) — backend kurulumu, veritabanı, ortam değişkenleri

## Teknoloji

| | |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS, React Router |
| **Backend** | Node.js, Express, PostgreSQL |
| **Ödeme** | PayTR (Direkt API / iFrame) |
| **E-posta** | Nodemailer (Gmail SMTP) |
| **Barındırma** | Vercel (frontend) · Railway (backend + veritabanı) |
| **Test / CI** | Vitest, GitHub Actions |

## Öne Çıkan Teknik Detaylar

- **Misafir sipariş** desteklenir — üyelik zorunlu değil
- **Sahiplik kontrolü**: bir kullanıcı yalnızca kendi sipariş/profil/favori
  bilgisine erişebilir (IDOR'a karşı korumalı)
- **Ödeme tutarı** istemciden değil, veritabanındaki kayıtlı siparişten
  okunur — fiyat manipülasyonuna kapalı
- **Rate limiting**: giriş, şifre sıfırlama, sipariş ve iletişim formunda
  kötüye kullanıma karşı sınırlama
- **XSS koruması**: admin panelinden gelen zengin metin içerikler
  (garanti, politika sayfaları) DOMPurify ile temizlenir
- Sipariş durumları, arama normalizasyonu, stok ve fiyat mantığı gibi
  kritik iş kuralları `domain/` altında test edilir (`npm test`)

## CI

Her push ve pull request'te otomatik çalışır: bağımlılık kurulumu, testler,
lint ve (frontend için) production build. Bkz.
[`.github/workflows/ci.yml`](./.github/workflows/ci.yml)

---

Bu repo Kemborn'a özel, kapalı kaynaklı bir ticari projedir.
