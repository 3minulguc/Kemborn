const express = require('express');
const { client } = require('../config/veritabani');
const { authLimiter, resetPasswordLimiter } = require('../config/limitler');
const { sifreKuraliniDenetle, SAHTE_PAROLA_HASH } = require('../domain/sifre');
const { sendMail, buildEmailHtml } = require('../lib/eposta');
const { JWT_SECRET, FRONTEND_URL } = require('../config/ortam');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const router = express.Router();

// ==========================================
// --- AUTHENTICATION (KİMLİK DOĞRULAMA) ---
// ==========================================
router.post('/api/register', authLimiter, async (req, res) => {
    const { username, email, password, phone } = req.body;

    if (!username || !username.trim()) {
        return res.status(400).json({ error: "Ad soyad boş olamaz." });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Geçerli bir e-posta adresi girin." });
    }
    const sifreHatasi = sifreKuraliniDenetle(password);
    if (sifreHatasi) {
        return res.status(400).json({ error: sifreHatasi });
    }
    const normalizedPhone = (phone || '').replace(/\D/g, '');
    if (!normalizedPhone || normalizedPhone.length !== 11) {
        return res.status(400).json({ error: "Geçerli bir telefon numarası girin (şifremi unuttum akışı için gereklidir)." });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        await client.query('INSERT INTO users (username, email, password_hash, phone) VALUES ($1, $2, $3, $4)', [username.trim(), email.trim().toLowerCase(), passwordHash, normalizedPhone]);
        res.status(201).json({ message: "Kayıt başarılı!" });
    } catch (err) {
        res.status(400).json({ error: "Bu email zaten kayıtlı." });
    }
});

router.post('/api/login', authLimiter, async (req, res) => {
    const { email, password, beniHatirla } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "E-posta ve şifre gereklidir." });
    }
    try {
        const result = await client.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
        const user = result.rows[0];

        // GÜVENLİK — kullanıcı sızıntısı:
        // Önceden "Kullanıcı bulunamadı" ve "Hatalı şifre" ayrı mesajlardı; bu,
        // bir e-postanın sitede kayıtlı olup olmadığını dışarıya söylüyordu.
        // Artık iki durumda da AYNI mesaj dönüyor.
        //
        // Ayrıca kullanıcı yokken bcrypt hiç çalışmadığı için cevap gözle görülür
        // biçimde daha hızlı dönüyordu; sadece süreye bakarak da e-posta tespit
        // edilebiliyordu. Kullanıcı bulunamasa bile sahte bir hash'e karşı
        // karşılaştırma yaparak süreyi eşitliyoruz.
        const gecerli = user
            ? await bcrypt.compare(password, user.password_hash)
            : await bcrypt.compare(password, SAHTE_PAROLA_HASH).then(() => false);

        if (!user || !gecerli) {
            return res.status(400).json({ error: "E-posta veya şifre hatalı." });
        }

        // "Beni hatırla" işaretliyse token daha uzun yaşıyor.
        //
        // 7 gün BİLEREK seçildi: token'ı geri çağırma (revocation) altyapısı yok,
        // yani çalınan bir token süresi dolana kadar geçerli kalıyor. 30 gün, o
        // riski dört kat uzatırdı. Admin hesabında "beni hatırla" hiç uygulanmıyor;
        // panel yetkisi en riskli token.
        const uzunOmur = beniHatirla === true && user.role !== 'admin';
        const token = jwt.sign(
            { id: user.id, role: user.role },
            JWT_SECRET,
            { expiresIn: uzunOmur ? '7d' : '24h' }
        );
        res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: "Giriş hatası." });
    }
});

// ==========================================
// --- ŞİFREMİ UNUTTUM (E-POSTA LİNKİ İLE, GÜVENLİ TOKEN AKIŞI) ---
// ==========================================
// 1. Adım: Kullanıcı e-postasını girer, ona tek kullanımlık bir link gönderilir.
router.post('/api/forgot-password', resetPasswordLimiter, async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: "E-posta adresi zorunludur." });
    }

    // Güvenlik: e-postanın kayıtlı olup olmadığını dışarıya sızdırmamak için,
    // kullanıcı bulunsa da bulunmasa da HER ZAMAN aynı başarı mesajını dönüyoruz.
    const genericResponse = { message: "Eğer bu e-posta kayıtlıysa, şifre sıfırlama linki gönderildi." };

    try {
        const result = await client.query('SELECT id, username FROM users WHERE email = $1', [email.trim().toLowerCase()]);
        if (result.rows.length === 0) {
            return res.json(genericResponse);
        }

        const user = result.rows[0];
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 saat geçerli

        await client.query('UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3', [token, expiry, user.id]);

        const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;
        await sendMail(
            email.trim().toLowerCase(),
            'Kemborn Şifre Sıfırlama Talebi',
            buildEmailHtml(
                `Merhaba, ${user.username || ''}`,
                `<p style="color:#52525b; font-size:14px; line-height:1.6;">Kemborn hesabınız için şifre sıfırlama talebinde bulundunuz. Aşağıdaki butona tıklayarak yeni bir şifre belirleyebilirsiniz.</p>
                 <a href="${resetLink}" style="display:inline-block; background:#18181b; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:12px; font-weight:bold; font-size:14px; margin-top:16px;">Şifremi Sıfırla</a>
                 <p style="color:#a1a1aa; font-size:12px; margin-top:20px;">Bu link 1 saat geçerlidir. Bu talebi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>`
            )
        );

        res.json(genericResponse);
    } catch (err) {
        console.error("Şifremi unuttum hatası:", err);
        res.status(500).json({ error: "Bir hata oluştu, lütfen tekrar deneyin." });
    }
});

// 2. Adım: Kullanıcı e-postadaki linke tıklayıp yeni şifresini belirler.
router.post('/api/reset-password', resetPasswordLimiter, async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: "Geçersiz istek." });
    }
    const yeniSifreHatasi = sifreKuraliniDenetle(newPassword);
    if (yeniSifreHatasi) {
        return res.status(400).json({ error: yeniSifreHatasi });
    }

    try {
        const result = await client.query(
          'SELECT id, email FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()',
          [token]
        );
        if (result.rows.length === 0) {
            return res.status(400).json({ error: "Bu link geçersiz veya süresi dolmuş. Lütfen şifremi unuttum işlemini tekrar başlatın." });
        }

        const user = result.rows[0];
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await client.query(
          'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2',
          [passwordHash, user.id]
        );
        res.json({ message: "Şifreniz başarıyla güncellendi!" });

        // E-POSTA: Şifre değişikliği güvenlik bildirimi
        sendMail(
            user.email,
            'Kemborn Hesabınızın Şifresi Değiştirildi',
            buildEmailHtml(
                'Şifreniz Güncellendi',
                `<p style="color:#52525b; font-size:14px; line-height:1.6;">Kemborn hesabınızın şifresi az önce değiştirildi.</p>
                 <p style="color:#dc2626; font-size:13px; font-weight:bold; margin-top:16px;">Bu işlemi siz yapmadıysanız, lütfen hemen bizimle iletişime geçin.</p>`
            )
        );
    } catch (err) {
        res.status(500).json({ error: "Sıfırlama başarısız." });
    }
});

module.exports = router;
