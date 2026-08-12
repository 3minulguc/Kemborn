const dns = require('dns').promises;

// ==========================================
// E-POSTA GERÇEKLİK KONTROLÜ
// ==========================================
// Biçim kontrolü (regex) "asdf@asdf.qwerty" gibi var olmayan bir domaini de
// geçerli sayar. Burada domainin DNS'te gerçekten var olup olmadığına
// bakılıyor: önce MX kaydı (mail sunucusu), yoksa A/AAAA kaydı (RFC 5321
// gereği MX yoksa mail A kaydına düşer). İkisi de yoksa domain muhtemelen
// hiç kayıtlı değildir — sipariş/kayıt onay maili hiçbir zaman ulaşmaz.
//
// DNS sorgusu başarısız olursa (resolver zaman aşımı, ağ sorunu vb.) BAŞARILI
// sayılır: geçici bir DNS hatası yüzünden gerçek bir müşteriyi reddetmek,
// sahte bir e-postayı kabul etmekten daha kötü bir hata.
const EMAIL_BICIM = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const domaininMailAlabilirMi = async (domain) => {
    try {
        const mx = await dns.resolveMx(domain);
        if (mx && mx.length > 0) return true;
    } catch {
        // MX kaydı yok — A/AAAA'ya bakılacak.
    }
    try {
        await dns.resolve(domain);
        return true;
    } catch {
        return false; // domain hiç çözümlenmiyor
    }
};

// true: e-posta biçimen geçerli VE domaini gerçekten mail alabilir gibi görünüyor.
const epostaGercekMi = async (email) => {
    const temiz = String(email || '').trim();
    if (!EMAIL_BICIM.test(temiz)) return false;

    const domain = temiz.split('@')[1];
    try {
        return await domaininMailAlabilirMi(domain);
    } catch {
        return true; // DNS sorgusu beklenmedik şekilde patladıysa reddetme
    }
};

module.exports = { epostaGercekMi, EMAIL_BICIM };
