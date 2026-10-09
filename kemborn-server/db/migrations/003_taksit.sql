-- ============================================================
-- 003 — Taksitli ödeme
-- ============================================================
-- NEDEN: Taksit açıldı. Taksitli ödemede müşteriden vade farkı dahil daha
-- yüksek bir tutar çekiliyor; total_amount (ürün + kargo) değişmiyor, gerçekte
-- çekilen tutar ve taksit sayısı iade/muhasebe için ayrıca saklanıyor.
-- Değerleri PayTR'nin ödeme bildirimi (/api/paytr-notify) yazıyor.
--
-- ÇALIŞTIRMA (kod canlıya çıkmadan ÖNCE — bildirim bu sütunlara yazıyor):
--   psql ... -f db/migrations/003_taksit.sql
--
-- Tekrar çalıştırılması güvenlidir.
-- ============================================================

-- 0 = tek çekim
ALTER TABLE orders ADD COLUMN IF NOT EXISTS taksit_sayisi       integer DEFAULT 0;
-- Karttan gerçekte çekilen tutar (vade farkı dahil). Ödeme gelene kadar NULL.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tahsil_edilen_tutar numeric(10,2);
