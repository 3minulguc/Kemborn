const express = require('express');
const { verifyToken, isAdmin } = require('../middleware/kimlik');
const { yuklemeLimiter } = require('../config/limitler');
const { UPLOAD_DIR, upload } = require('../config/yukleme');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// ==========================================
// --- MEDYA YÜKLEME ROTASI (GÖRSEL / VİDEO) ---
// ==========================================
router.post('/api/upload', verifyToken, isAdmin, yuklemeLimiter, (req, res) => {
    const uploadFields = upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]);
    uploadFields(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message || 'Dosya yüklenemedi.' });

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const response = {};
        if (req.files?.image?.[0]) response.image_url = `${baseUrl}/uploads/${req.files.image[0].filename}`;
        if (req.files?.video?.[0]) response.video_url = `${baseUrl}/uploads/${req.files.video[0].filename}`;

        if (!response.image_url && !response.video_url) {
            return res.status(400).json({ error: 'Hiçbir dosya alınamadı.' });
        }
        res.status(201).json(response);
    });
});

// --- ARTIK KULLANILMAYAN BİR DOSYAYI DİSKTEN SİLME (yeniden kırpma/kaldırma sonrası "yetim" dosya birikmesin) ---
router.delete('/api/upload', verifyToken, isAdmin, (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Silinecek dosya belirtilmedi.' });
    }
    try {
        const filename = path.basename(new URL(url).pathname);
        // Güvenlik: path traversal'ı önlemek için sadece dosya adını kullanıyoruz,
        // ve gerçekten UPLOAD_DIR içinde kalıp kalmadığını doğruluyoruz.
        const fullPath = path.join(UPLOAD_DIR, filename);
        if (!fullPath.startsWith(UPLOAD_DIR)) {
            return res.status(400).json({ error: 'Geçersiz dosya yolu.' });
        }
        fs.unlink(fullPath, (err) => {
            // Dosya zaten yoksa (ENOENT) sorun değil, sessizce başarı dönüyoruz
            if (err && err.code !== 'ENOENT') {
                console.error("Dosya silinemedi:", err);
            }
            res.json({ message: 'Dosya silindi (veya zaten yoktu).' });
        });
    } catch (err) {
        res.status(400).json({ error: 'Geçersiz URL.' });
    }
});

module.exports = router;
