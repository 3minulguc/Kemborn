# Kemborn Intercom — İstemci

Kemborn Intercom e-ticaret sitesinin frontend'i. React 19 + Vite + Tailwind.
Backend için [`kemborn-server`](../kemborn-server/README.md)'a bakın.

## Kurulum

```bash
npm install
npm run dev
```

Varsayılan olarak `http://localhost:5005` adresindeki sunucuya bağlanır
(bkz. `src/config/api.js`) — ayrı bir `.env` dosyasına gerek yok, sunucu
yerelde açıksa direkt çalışır.

Canlıya çıkarken gerçek API adresini belirtmek için:

```bash
cp .env.example .env.production
# içine VITE_API_URL=https://<backend-adresin> yaz
```

## Ölçümleme (Google Analytics / Meta Pixel)

İkisi de **isteğe bağlı** ve varsayılan olarak **kapalı**:

| Değişken | Nereden alınır |
|---|---|
| `VITE_GA4_ID` | Google Analytics → Yönetici → Veri akışları (`G-` ile başlar) |
| `VITE_META_PIXEL_ID` | Meta Events Manager → Veri kaynakları |

Nasıl çalışıyor:

- **Kimlik boşken** hiçbir script yüklenmez, site tek bir fazladan istek bile
  atmaz. Çerez banner'ı "bilgilendirme" modunda kalır (tek "Anladım" butonu).
- **Kimlik doluyken** banner "Kabul Et / Reddet" moduna geçer ve ölçüm araçları
  **yalnızca kullanıcı kabul ederse** yüklenir. KVKK gereği böyle olmak zorunda;
  takip çerezi için sessiz kabul geçerli değil, bu yüzden banner'ı X ile
  kapatmak da reddetme sayılıyor.

Toplanan olaylar: `page_view`, `view_item`, `add_to_cart`, `begin_checkout`,
`purchase`. Hepsi `src/utils/analitik.js` üzerinden geçiyor — yeni bir olay
eklemek gerekirse orası tek giriş noktası.

Yayına alırken kimlikler **Vercel → Settings → Environment Variables** altına
da eklenmeli. Vite değişkenleri derleme anında gömüldüğü için, ekledikten
sonra **yeniden dağıtım (redeploy) şart** — yoksa eski paket çalışmaya devam eder.

## Script'ler

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Production build (`dist/`) |
| `npm run preview` | Build edilmiş halini yerelde önizle |
| `npm run lint` | ESLint |
| `npm run mobil` | 390px genişlikte ekran görüntüsü + dokunma hedefi/taşma kontrolü (`scripts/mobil-kontrol.mjs`) |

## Mobil doğrulama

**Bu projede mobil birinci önceliktir.** Arayüzle ilgili her değişiklik hem
390px hem masaüstü genişliğinde doğrulanmalı. `npm run mobil` otomatik
ölçüm yapar (yatay taşma, 44px'in altında dokunma hedefi) ama tek başına
yeterli değil — bazı bozukluklar (metin bölünmesi, üst üste binme) sadece
ekran görüntüsünde fark edilir. Şüpheli bir değişiklikten sonra ilgili
sayfanın ekran görüntüsünü almak en güvenlisi.

## Klasör yapısı

| Klasör | İçerik |
|---|---|
| `src/pages/` | Sayfa bileşenleri (`admin/` ve `user/` alt klasörleri panel sayfaları) |
| `src/components/` | Sayfalar arası paylaşılan bileşenler (Header, Footer, ProductCard...) |
| `src/context/` | React Context (kimlik doğrulama durumu) |
| `src/hooks/` | Paylaşılan hook'lar (favoriler vb.) |
| `src/utils/` | Saf yardımcı fonksiyonlar — biçimlendirme, arama normalizasyonu, HTML temizleme |
| `src/content/yasal/` | Mesafeli satış, KVKK, teslimat-iade metinlerinin **tek kaynağı**. Admin panelindeki "Sıfırla" düğmesi buradan besleniyor. |
| `src/config/` | API adresi gibi ortam bazlı sabitler |

## Yasal metinler

`src/content/yasal/` altındaki üç HTML dosyası hukuki belge — düzenlemek
için admin panelini kullan (Ayarlar → Yasal Metinler), doğrudan bu
dosyaları elden düzenlemek yerine. Panel değişikliği veritabanına yazar;
bu dosyalar sadece "bozulursa dönülecek asıl metin" olarak duruyor.

## Deploy (Vercel)

`vercel.json` içindeki rewrite kuralı SPA yönlendirmesi için zorunlu —
onsuz `/about` gibi bir adrese doğrudan girmek (yenileme dahil) 404 döner.
Vercel projesinin **Root Directory** ayarının `kemborn-client` olduğundan
emin ol; aksi halde bu dosya hiç okunmaz.

## Testler

```bash
npm test
```

Saf yardımcı fonksiyonlar (`src/utils/`) için Vitest testleri var. CI,
`main`'e her push'ta ve her PR'da bunları ve ESLint'i otomatik çalıştırır
(`.github/workflows/ci.yml`).
