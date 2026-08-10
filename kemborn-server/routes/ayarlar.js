const express = require('express');
const { client } = require('../config/veritabani');
const { verifyToken, isAdmin } = require('../middleware/kimlik');

const router = express.Router();

// ==========================================
// --- MAĞAZA AYARLARI ROTALARI ---
// ==========================================
router.get('/api/settings', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM store_settings WHERE id = 1');
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: "Ayarlar çekilemedi." });
  }
});

router.put('/api/settings', verifyToken, isAdmin, async (req, res) => {
  const { shipping_fee, free_shipping_threshold, warranty_badge_text, warranty_tab_title, warranty_tab_bullets, customer_service_phone, whatsapp_phone, support_email, office_address, distance_selling_policy, privacy_policy, delivery_return_policy, trendyol_url, hepsiburada_url, n11_url, instagram_url, youtube_url, tiktok_url } = req.body;

  const safeShippingFee = (shipping_fee === "" || shipping_fee === undefined) ? 0 : parseFloat(shipping_fee);
  const safeThreshold = (free_shipping_threshold === "" || free_shipping_threshold === undefined) ? 0 : parseFloat(free_shipping_threshold);

  // Müşteri tarafında gösterilen kargo yazısı artık elle yazılmıyor,
  // buradaki iki sayıdan OTOMATİK olarak üretiliyor.
  const autoShippingText = safeThreshold > 0
    ? `${safeThreshold.toLocaleString('tr-TR')} TL üzeri siparişlerde kargo bedava`
    : 'Tüm siparişlerde kargo bedava';

  try {
    const result = await client.query(
      `UPDATE store_settings SET shipping_text = $1, shipping_fee = $2, free_shipping_threshold = $3, warranty_badge_text = $4, warranty_tab_title = $5, warranty_tab_bullets = $6, customer_service_phone = $7, whatsapp_phone = $8, support_email = $9, office_address = $10, distance_selling_policy = $11, privacy_policy = $12, delivery_return_policy = $13, trendyol_url = $14, hepsiburada_url = $15, n11_url = $16, instagram_url = $17, youtube_url = $18, tiktok_url = $19 WHERE id = 1 RETURNING *`,
      [autoShippingText, safeShippingFee, safeThreshold, warranty_badge_text, warranty_tab_title, warranty_tab_bullets, customer_service_phone, whatsapp_phone, support_email, office_address, distance_selling_policy, privacy_policy, delivery_return_policy, trendyol_url || null, hepsiburada_url || null, n11_url || null, instagram_url || null, youtube_url || null, tiktok_url || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Ayarlar güncellenemedi." });
  }
});

module.exports = router;
