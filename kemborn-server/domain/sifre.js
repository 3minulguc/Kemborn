// Şifre kuralı ve giriş zamanlaması ile ilgili sabitler.

// Önceden tek kural "en az 6 karakter"di; "123456" geçiyordu.
// Kural bilerek ölçülü tutuldu: en az 8 karakter ve hem harf hem rakam.
// Daha katı kurallar (büyük harf, sembol zorunluluğu) müşteriyi kaydolmaktan
// vazgeçiriyor ve pratikte daha güvenli şifre üretmiyor.
const COK_KULLANILAN_SIFRELER = [
    '12345678', '123456789', '1234567890', 'password', 'parola123', 'sifre123',
    'qwerty123', 'admin123', '11111111', 'abcd1234', 'kemborn123'
];

const sifreKuraliniDenetle = (sifre) => {
    const s = String(sifre || '');
    if (s.length < 8) return "Şifre en az 8 karakter olmalı.";
    if (!/[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(s)) return "Şifre en az bir harf içermeli.";
    if (!/[0-9]/.test(s)) return "Şifre en az bir rakam içermeli.";
    if (COK_KULLANILAN_SIFRELER.includes(s.toLowerCase())) {
        return "Bu şifre çok yaygın kullanılıyor, lütfen başka bir şifre seçin.";
    }
    return null; // sorun yok
};

// Giriş denemelerinde, kullanıcı bulunmasa bile bcrypt karşılaştırması
// yapılabilmesi için sabit bir sahte hash. Amaç cevap süresini eşitlemek:
// yoksa "kullanıcı yok" cevabı belirgin şekilde daha hızlı dönüyor ve
// sadece süreye bakarak e-postanın kayıtlı olup olmadığı anlaşılabiliyordu.
const SAHTE_PAROLA_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8._9Zc0hE2sJ3s5Z2K1cQqB5m8QnZa';

module.exports = { sifreKuraliniDenetle, SAHTE_PAROLA_HASH };
