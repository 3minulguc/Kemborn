const express = require('express');
const { client } = require('../config/veritabani');
const { verifyToken, verifyOwnership } = require('../middleware/kimlik');
const { sifreKuraliniDenetle } = require('../domain/sifre');
const { sendMail, buildEmailHtml } = require('../lib/eposta');
const bcrypt = require('bcryptjs');

const router = express.Router();

// ==========================================
// --- KULLANICI PROFİL ROTALARI ---
// ==========================================
router.get('/api/users/:id', verifyToken, verifyOwnership('id'), async (req, res) => {
    try {
        const result = await client.query('SELECT id, username, email, phone, address, role FROM users WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Profil bilgileri alınamadı." });
    }
});

router.put('/api/users/:id', verifyToken, verifyOwnership('id'), async (req, res) => {
    const { username, phone, address } = req.body;
    try {
        const result = await client.query('UPDATE users SET username = $1, phone = $2, address = $3 WHERE id = $4 RETURNING id, username, email, role, phone, address', [username, phone, address, req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Kullanıcı bulunamadı." });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Profil güncellenemedi." });
    }
});

// ==========================================
// --- ŞİFRE GÜNCELLEME ROTASI (DÜZELTİLDİ) ---
// ==========================================
router.put('/api/users/:id/password', verifyToken, verifyOwnership('id'), async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Mevcut şifre ve yeni şifre zorunludur." });
    }
    const yeniSifreHatasi = sifreKuraliniDenetle(newPassword);
    if (yeniSifreHatasi) {
        return res.status(400).json({ error: yeniSifreHatasi });
    }
    
    try {
        // 'password_hash' sütununu çekiyoruz
        const result = await client.query('SELECT email, password_hash FROM users WHERE id = $1', [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Kullanıcı bulunamadı." });
        }

        const user = result.rows[0];

        // bcrypt ile şifreyi doğruluyoruz
        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
        
        if (!validPassword) {
            return res.status(400).json({ error: "Mevcut şifreniz hatalı!" });
        }

        // Yeni şifreyi hash'liyoruz
        const salt = await bcrypt.genSalt(10);
        const hashedNewPassword = await bcrypt.hash(newPassword, salt);

        // 'password_hash' sütununu güncelliyoruz
        await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedNewPassword, req.params.id]);

        res.status(200).json({ message: "Şifreniz başarıyla güncellendi." });

        // E-POSTA: Şifre değişikliği güvenlik bildirimi
        sendMail(
            user.email,
            'Kemborn Hesabınızın Şifresi Değiştirildi',
            buildEmailHtml(
                'Şifreniz Güncellendi',
                `<p style="color:#52525b; font-size:14px; line-height:1.6;">Kemborn hesabınızın şifresi az önce, hesap ayarlarınızdan değiştirildi.</p>
                 <p style="color:#dc2626; font-size:13px; font-weight:bold; margin-top:16px;">Bu işlemi siz yapmadıysanız, lütfen hemen bizimle iletişime geçin.</p>`
            )
        );
        
    } catch (err) {
        console.error("Şifre güncelleme hatası:", err);
        res.status(500).json({ error: "Şifre güncellenirken sunucu hatası oluştu." });
    }
});

module.exports = router;
