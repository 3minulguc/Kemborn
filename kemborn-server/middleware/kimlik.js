// Güvenlik middleware'leri (yakın koruma).

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/ortam');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ error: "Giriş yapmanız gerekiyor!" });

    try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Oturum süresi dolmuş, tekrar giriş yapın." });
    }
};

const isAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: "Yetkisiz erişim! Sadece yöneticiler girebilir." });
    }
    next();
};

// Girişi ZORUNLU KILMAYAN doğrulama.
// Misafir sipariş için gerekli: token varsa ve geçerliyse req.user doldurulur,
// yoksa istek misafir olarak devam eder. Geçersiz/süresi dolmuş token da
// misafir sayılır — ziyaretçiyi ödeme adımında hata ekranına düşürmek yerine
// misafir olarak devam ettirmek doğru davranış.
const verifyTokenOptional = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        try {
            const token = authHeader.split(" ")[1];
            req.user = jwt.verify(token, JWT_SECRET);
        } catch {
            req.user = null;
        }
    }
    next();
};

// --- SAHİPLİK KONTROLÜ ---
// verifyToken "geçerli bir üye mi?" sorusunu cevaplıyor ama "bu veri ONA mı ait?"
// sorusunu cevaplamıyordu. Bu eksik yüzünden bir üye, adresteki id'yi değiştirerek
// BAŞKASININ profiline / siparişlerine / favorilerine erişebiliyordu (IDOR).
// Aşağıdaki yardımcı, token'daki id ile adresteki id'yi karşılaştırır.
// NOT: Token'dan gelen id sayı, adresten gelen id metin olduğu için String() ile eşitliyoruz.
const isSelf = (req, paramName) => String(req.user?.id) === String(req.params[paramName]);
const isAdminUser = (req) => req.user?.role === 'admin';

// Rota parametresindeki kullanıcı id'si, isteği yapan kişinin kendisi (ya da admin) olmalı.
const verifyOwnership = (paramName) => (req, res, next) => {
    if (!isSelf(req, paramName) && !isAdminUser(req)) {
        return res.status(403).json({ error: "Bu bilgiye erişim yetkiniz yok." });
    }
    next();
};

// isAdminUser dışa açık: sahiplik kontrolü her zaman rota parametresine
// bakmıyor. Sipariş detayında sahiplik, adresteki id'den değil siparişin
// user_id sütunundan geliyor; o rota kendi kontrolünü yapıp bu yardımcıyı
// kullanıyor.
module.exports = { verifyToken, isAdmin, verifyTokenOptional, verifyOwnership, isAdminUser };
