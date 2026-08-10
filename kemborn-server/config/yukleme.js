// Dosya yükleme (görsel / video) ayarları.

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    video: ['video/mp4', 'video/webm', 'video/quicktime']
};

// Dosya uzantısı ARTIK istemciden gelen isme göre değil, kabul edilen
// mime tipine göre belirleniyor. Önceden path.extname(file.originalname)
// kullanılıyordu; "resim.jpg.html" gibi bir isimle diske .html uzantılı
// dosya yazdırmak mümkündü.
const MIME_UZANTI = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov'
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const uzanti = MIME_UZANTI[file.mimetype] || '.bin';
        const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${uzanti}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB üst sınır (video için)
    fileFilter: (req, file, cb) => {
        const isImage = ALLOWED_MIME_TYPES.image.includes(file.mimetype);
        const isVideo = ALLOWED_MIME_TYPES.video.includes(file.mimetype);
        if (file.fieldname === 'image' && !isImage) {
            return cb(new Error('Sadece JPEG, PNG, WEBP veya GIF formatında görsel yükleyebilirsiniz.'));
        }
        if (file.fieldname === 'video' && !isVideo) {
            return cb(new Error('Sadece MP4, WEBM veya MOV formatında video yükleyebilirsiniz.'));
        }
        cb(null, true);
    }
});

module.exports = { UPLOAD_DIR, upload };
