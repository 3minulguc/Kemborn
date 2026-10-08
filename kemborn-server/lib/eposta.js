// E-posta gönderme altyapısı (Resend — HTTPS API).
//
// Önceden Gmail SMTP (nodemailer) kullanılıyordu. Railway'in çıkışı SMTP
// portlarını (465 VE 587) tamamen bloke ediyor — IPv4'e zorlasan da,
// STARTTLS'e geçsen de "Connection timeout" ile dakikalarca bekleyip
// başarısız oluyordu, sipariş ve iletişim formu istekleri bu yüzden
// kilitleniyordu (madde 66/72). Resend düz HTTPS (443) üzerinden çalıştığı
// için bu port bloğundan etkilenmiyor.
//
// NOT: RESEND_API_KEY .env dosyasında tanımlı değilse, e-posta gönderimi
// sessizce atlanır (sunucu çökmez, sadece log'a yazar).

// dotenv'in yüklendiğinden emin olmak için (bkz. config/ortam.js)
require('../config/ortam');

const { Resend } = require('resend');
const { logToFile } = require('./log');

let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn('⚠️  UYARI: RESEND_API_KEY .env dosyasında tanımlı değil. Sipariş/kargo/şifre e-postaları gönderilmeyecek.');
}

// Gönderen adresi. kemborn.com Resend'de doğrulanana kadar sadece Resend'in
// test adresi (onboarding@resend.dev) kullanılabilir — o da yalnızca Resend
// hesabının kendi adresine teslim olur, gerçek müşteriye gitmez. Domain
// doğrulanınca Railway'de EMAIL_FROM tanımlanıp buraya dokunmadan geçilir.
const GONDEREN_ADRESI = process.env.EMAIL_FROM || 'Kemborn <onboarding@resend.dev>';

// Tüm e-postalarda kullanılan ortak, sade HTML şablonu
const buildEmailHtml = (title, bodyHtml) => `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #f4f4f5; padding: 24px;">
    <div style="background: #18181b; padding: 20px; border-radius: 16px 16px 0 0; text-align: center;">
      <h1 style="color: #ffffff; font-size: 20px; margin: 0; letter-spacing: 1px;">KEMBORN</h1>
    </div>
    <div style="background: #ffffff; padding: 28px; border-radius: 0 0 16px 16px;">
      <h2 style="color: #18181b; font-size: 18px; margin-top: 0;">${title}</h2>
      ${bodyHtml}
    </div>
    <p style="text-align: center; color: #a1a1aa; font-size: 12px; margin-top: 16px;">Bu e-posta Kemborn tarafından otomatik olarak gönderilmiştir.</p>
  </div>
`;

// Mağaza sahibine bildirim gidecek adres (yeni sipariş, iletişim formu mesajı vb).
const MAGAZA_BILDIRIM_ADRESI = process.env.ADMIN_NOTIFY_EMAIL || null;

// "Best effort" gönderim: e-posta gönderilemese bile ana işlemi (sipariş, şifre vs.) DURDURMAZ.
//
// replyTo: iletişim formu için gerekli. Mesaj mağazanın kendi adresinden
// gönderiliyor, dolayısıyla "Yanıtla" dediğinde kendine cevap yazmış olurdun.
// Bu alan doluysa yanıt doğrudan müşteriye gider.
const sendMail = async (to, subject, html, replyTo = null) => {
  if (!resend || !to) return;
  try {
    const { error } = await resend.emails.send({
      from: GONDEREN_ADRESI,
      to,
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {})
    });
    if (error) throw new Error(error.message || JSON.stringify(error));
  } catch (err) {
    console.error('❌ E-posta gönderilemedi:', err.message);
    logToFile('error.log', `MAIL SEND ERROR (to: ${to}, subject: ${subject}): ${err.message}`);
  }
};

// Kullanıcıdan gelen metin e-posta HTML'ine gömülüyor. Kaçırılmazsa gönderen
// kişi e-postanın içine kendi HTML'ini (bağlantı, script, sahte "buton")
// yazabilir; mağaza sahibi de bunu güvenilir bir bildirim sanır.
const htmlKacir = (metin) => String(metin ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

module.exports = { buildEmailHtml, sendMail, MAGAZA_BILDIRIM_ADRESI, htmlKacir };
