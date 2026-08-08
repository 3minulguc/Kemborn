-- ============================================================
-- KEMBORN — BAŞLANGIÇ VERİSİ
-- ============================================================
-- schema.sql çalıştırıldıktan SONRA bir kez çalıştırılır:
--   psql -h localhost -p 5432 -U postgres -d postgres -f db/seed.sql
--
-- Tekrar tekrar çalıştırmak güvenlidir (ON CONFLICT DO NOTHING).
-- ============================================================

-- ------------------------------------------------------------
-- MAĞAZA AYARLARI — ZORUNLU
-- ------------------------------------------------------------
-- Kod store_settings tablosunu her zaman "WHERE id = 1" ile okur ve günceller.
-- Bu satır yoksa: ayarlar sayfası boş gelir, admin panelinden yapılan
-- güncellemeler hiçbir satıra denk gelmediği için sessizce kaybolur ve
-- ödeme sayfasındaki kargo hesabı varsayılan değerlere düşer.
INSERT INTO store_settings (
    id,
    shipping_fee,
    free_shipping_threshold,
    shipping_text
) VALUES (
    1,
    99.90,
    1000,
    '1.000 TL üzeri siparişlerde kargo bedava'
) ON CONFLICT (id) DO NOTHING;


-- ------------------------------------------------------------
-- YÖNETİCİ HESABI
-- ------------------------------------------------------------
-- Uygulamada admin yapan bir arayüz YOK; ilk admin elle oluşturulur.
--
-- 1) Siteden normal şekilde üye ol (Ad soyad, e-posta, şifre, telefon).
-- 2) Sonra aşağıdaki satırdaki e-postayı kendi e-postanla değiştirip çalıştır:
--
--    UPDATE users SET role = 'admin' WHERE email = 'senin@epostan.com';
--
-- Şifreyi doğrudan buraya yazmıyoruz; bcrypt hash'i kayıt sırasında
-- uygulamanın kendisi üretsin diye bu yol tercih edildi.
