// E-posta gönderme altyapısı (Gmail SMTP).
//
// NOT: EMAIL_USER ve EMAIL_APP_PASSWORD .env dosyasında tanımlı değilse,
// e-posta gönderimi sessizce atlanır (sunucu çökmez, sadece log'a yazar).
// EMAIL_APP_PASSWORD normal Gmail şifresi DEĞİL, Google Hesabı'ndan üretilen
// 16 haneli "Uygulama Şifresi"dir (2 Adımlı Doğrulama açık olmalı).

// dotenv'in yüklendiğinden emin olmak için (bkz. config/ortam.js)
require('../config/ortam');

const nodemailer = require('nodemailer');
const { logToFile } = require('./log');

let mailTransporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
  mailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD
    }
  });
} else {
  console.warn('⚠️  UYARI: EMAIL_USER / EMAIL_APP_PASSWORD .env dosyasında tanımlı değil. Sipariş/kargo/şifre e-postaları gönderilmeyecek.');
}

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

// Mağaza sahibine bildirim gidecek adres. Tanımlı değilse EMAIL_USER'a düşer
// (mağaza zaten kendi Gmail hesabından gönderiyor).
const MAGAZA_BILDIRIM_ADRESI = process.env.ADMIN_NOTIFY_EMAIL || process.env.EMAIL_USER || null;

// "Best effort" gönderim: e-posta gönderilemese bile ana işlemi (sipariş, şifre vs.) DURDURMAZ.
const sendMail = async (to, subject, html) => {
  if (!mailTransporter || !to) return;
  try {
    await mailTransporter.sendMail({
      from: `"Kemborn" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
  } catch (err) {
    console.error('❌ E-posta gönderilemedi:', err.message);
    logToFile('error.log', `MAIL SEND ERROR (to: ${to}, subject: ${subject}): ${err.message}`);
  }
};

module.exports = { buildEmailHtml, sendMail, MAGAZA_BILDIRIM_ADRESI };
