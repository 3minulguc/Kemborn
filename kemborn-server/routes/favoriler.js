const express = require('express');
const { client } = require('../config/veritabani');
const { verifyToken, verifyOwnership } = require('../middleware/kimlik');

const router = express.Router();

// ==========================================
// --- FAVORİLER ROTALARI ---
// ==========================================
router.get('/api/favorites/:userId', verifyToken, verifyOwnership('userId'), async (req, res) => {
  try {
    const result = await client.query(`SELECT p.* FROM products p JOIN favorites f ON p.id = f.product_id WHERE f.user_id = $1`, [req.params.userId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Favoriler çekilemedi." });
  }
});

router.post('/api/favorites', verifyToken, async (req, res) => {
  const { productId } = req.body;
  // GÜVENLİK: userId artık istekten OKUNMUYOR, token'dan alınıyor.
  // Aksi halde bir üye, body'ye başka bir userId yazarak başkasının
  // favori listesine ürün ekleyebiliyordu.
  const userId = req.user.id;
  try {
    await client.query('INSERT INTO favorites (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, productId]);
    res.status(201).json({ message: "Favorilere eklendi" });
  } catch (err) {
    res.status(500).json({ error: "Favoriye eklenemedi." });
  }
});

router.delete('/api/favorites/:userId/:productId', verifyToken, verifyOwnership('userId'), async (req, res) => {
  try {
    await client.query('DELETE FROM favorites WHERE user_id = $1 AND product_id = $2', [req.params.userId, req.params.productId]);
    res.status(200).json({ message: "Favorilerden silindi" });
  } catch (err) {
    res.status(500).json({ error: "Favoriden silinemedi." });
  }
});

module.exports = router;
