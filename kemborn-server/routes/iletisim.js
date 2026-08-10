const express = require('express');
const { iletisimLimiter } = require('../config/limitler');
const { sendMail, buildEmailHtml, MAGAZA_BILDIRIM_ADRESI, htmlKacir } = require('../lib/eposta');
const { logToFile } = require('../lib/log');

const router = express.Router();

// ==========================================
// --- İLETİŞİM FORMU ---
// ==========================================
// Önceden sitede yazılı ulaşma yolu YOKTU; sadece telefon, WhatsApp ve
// e-posta bağlantıları vardı. Telefon etmek istemeyen ya da mesai dışında
// yazan müşteri hiçbir iz bırakamıyordu.

const KONULAR = ['Sipariş', 'Ürün', 'İade / İptal', 'Kurulum', 'Diğer'];

router.post('/api/iletisim', iletisimLimiter, async (req, res) => {
    const { ad, email, konu, mesaj } = req.body || {};

    const temizAd = String(ad || '').trim();
    const temizEmail = String(email || '').trim().toLowerCase();
    const temizMesaj = String(mesaj || '').trim();
    const temizKonu = KONULAR.includes(konu) ? konu : 'Diğer';

    if (temizAd.length < 2 || temizAd.length > 60) {
        return res.status(400).json({ error: 'Lütfen adınızı girin.' });
    }
    // Kasten gevşek bir kontrol: katı e-posta regex'leri geçerli adresleri de
    // reddedebiliyor. Adres yanlışsa zaten yanıt ulaşmayacak, engellemesi bize
    // bir şey kazandırmıyor.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(temizEmail) || temizEmail.length > 120) {
        return res.status(400).json({ error: 'Geçerli bir e-posta adresi girin.' });
    }
    if (temizMesaj.length < 10) {
        return res.status(400).json({ error: 'Mesajınız en az 10 karakter olmalı.' });
    }
    if (temizMesaj.length > 2000) {
        return res.status(400).json({ error: 'Mesajınız çok uzun (en fazla 2000 karakter).' });
    }

    // E-posta altyapısı kurulu değilse mesaj hiçbir yere gitmez. Müşteriye
    // "gönderildi" demek yanıltıcı olur; başka bir yoldan ulaşmasını söylüyoruz.
    if (!MAGAZA_BILDIRIM_ADRESI) {
        logToFile('error.log', 'ILETISIM FORMU: MAGAZA_BILDIRIM_ADRESI tanimli degil, mesaj gonderilemedi.');
        return res.status(503).json({
            error: 'Mesaj sistemi şu an kullanılamıyor. Lütfen telefon veya WhatsApp ile ulaşın.'
        });
    }

    await sendMail(
        MAGAZA_BILDIRIM_ADRESI,
        `📩 İletişim formu — ${temizKonu} (${temizAd})`,
        buildEmailHtml(
            'Siteden yeni bir mesaj var',
            `<p style="color:#52525b; font-size:14px; margin:0 0 4px;"><b>Gönderen:</b> ${htmlKacir(temizAd)}</p>
             <p style="color:#52525b; font-size:14px; margin:0 0 4px;"><b>E-posta:</b> ${htmlKacir(temizEmail)}</p>
             <p style="color:#52525b; font-size:14px; margin:0 0 16px;"><b>Konu:</b> ${htmlKacir(temizKonu)}</p>
             <div style="border-top:1px solid #e4e4e7; padding-top:16px; color:#18181b; font-size:15px; line-height:1.7; white-space:pre-wrap;">${htmlKacir(temizMesaj)}</div>
             <p style="color:#a1a1aa; font-size:12px; margin-top:20px;">Bu e-postayı yanıtlarsan cevap doğrudan müşteriye gider.</p>`
        ),
        temizEmail   // replyTo
    );

    logToFile('access.log', `ILETISIM FORMU: ${temizKonu} — ${temizEmail}`);
    res.json({ message: 'Mesajınız iletildi. En kısa sürede size dönüş yapacağız.' });
});

module.exports = router;
