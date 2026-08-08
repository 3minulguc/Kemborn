-- ============================================================
-- 001 — Pazaryeri ve sosyal medya bağlantı sütunları
-- ============================================================
-- NEDEN: "Mağazalarımız" ve "Sosyal Medyalarımız" sayfaları eklendiğinde
-- (commit 26605d0) bu 6 sütun canlı veritabanına ELLE eklenmiş, ama kayıt
-- altına alınmamıştı. Sonuç: yerel geliştirme veritabanı geride kaldı ve
-- PUT /api/settings yerelde "Ayarlar güncellenemedi" hatası veriyor.
--
-- ÇALIŞTIRMA:
--   psql -h localhost -p 5432 -U postgres -d postgres \
--        -f db/migrations/001_pazaryeri_ve_sosyal_medya_urllari.sql
--
-- Sütunlar zaten varsa (canlı veritabanı gibi) hiçbir şey yapmaz, güvenle
-- tekrar çalıştırılabilir.
-- ============================================================

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS trendyol_url    text;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS hepsiburada_url text;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS n11_url         text;

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS instagram_url   text;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS youtube_url     text;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tiktok_url      text;
