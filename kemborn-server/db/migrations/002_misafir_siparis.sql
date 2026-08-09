-- ============================================================
-- 002 — Misafir (üyeliksiz) sipariş desteği
-- ============================================================
-- NEDEN: Ödeme için üyelik zorunluydu. Sepete ürün ekleyen ziyaretçi ödeme
-- adımında "Giriş Yapmanız Gerekiyor" duvarına çarpıyor ve önemli bir kısmı
-- vazgeçiyordu. Artık üye olmadan da sipariş verilebiliyor.
--
-- Müşteri bilgisi şimdiye kadar users tablosundan JOIN ile geliyordu; misafir
-- siparişlerde böyle bir kayıt olmadığı için iletişim bilgileri siparişin
-- kendisinde saklanıyor.
--
-- ÇALIŞTIRMA:
--   psql ... -f db/migrations/002_misafir_siparis.sql
--
-- Tekrar çalıştırılması güvenlidir.
-- ============================================================

-- Misafir müşterinin iletişim bilgileri (üye siparişlerinde NULL kalır)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_email  character varying(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_name   character varying(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_phone  character varying(20);

-- Misafirin kendi siparişine erişmesi için üretilen tek kullanımlık anahtar.
-- Üyede oturum var, misafirde yok; ödeme başlatma ve sipariş durumu sorgulama
-- bu anahtarla doğrulanıyor. Tahmin edilemez olması için 32 bayt rastgele.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS access_token character varying(64);

-- Sipariş sorgulama sayfası (sipariş no + e-posta) bu ikisiyle arama yapıyor
CREATE INDEX IF NOT EXISTS orders_guest_email_idx ON orders (LOWER(guest_email));
CREATE INDEX IF NOT EXISTS orders_access_token_idx ON orders (access_token);

-- NOT: user_id sütunu zaten NULL kabul ediyordu, değiştirmeye gerek yok.
-- Misafir siparişlerde user_id NULL, guest_* alanları dolu olur.
