const express = require('express');
const { client, transactionIle } = require('../config/veritabani');
const { verifyToken, isAdmin } = require('../middleware/kimlik');
const { JWT_SECRET } = require('../config/ortam');
const jwt = require('jsonwebtoken');
const { aramaIcinNormalize, sqlKatlamaParametreleri } = require('../domain/arama');

const router = express.Router();

// ==========================================
// --- ÜRÜN ROTALARI ---
// ==========================================
router.get('/api/products', async (req, res) => {
  // Admin panelinden gelen istekse (geçerli admin token'ı varsa) gizli ürünler de dahil tüm liste dönülür.
  // Müşteri tarafındaki (Ürünler, Ürün Detay vb.) isteklerde ise sadece "Müşterilere Açık" ürünler dönülür.
  let isAdminRequest = false;
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded?.role === 'admin') isAdminRequest = true;
    } catch (err) {
      // Token geçersiz/süresi dolmuşsa sessizce müşteri gibi davran, hata döndürme.
    }
  }

  // --- ARAMA / FİLTRE / SIRALAMA / SAYFALAMA PARAMETRELERİ ---
  const { search, minPrice, maxPrice, inStock, sort, page, limit } = req.query;
  const conditions = [];
  const values = [];

  // ORDER BY'a kullanıcı girdisi doğrudan eklenmiyor (SQL injection riski);
  // sadece bu listedeki sabit ifadelerden biri seçilebiliyor.
  //
  // "name" sıralaması BURADA YOK: Türkçe harf sırası (İ/I, Ç, Ş...) veritabanı
  // collation'ına bağlı ve production'da hangi collation'ların kurulu olduğu
  // garanti değil — yanlış adı denemek sıralama isteğini 500'letebilirdi.
  // İsme göre sıralama istemci tarafında, zaten Türkçe uyumlu localeCompare
  // kullanan mevcut mantıkla yapılmaya devam ediyor.
  const SIRALAMA_SECENEKLERI = {
    'price-asc': 'price ASC',
    'price-desc': 'price DESC',
    default: 'sort_order ASC, id DESC'
  };
  const siralama = SIRALAMA_SECENEKLERI[sort] || SIRALAMA_SECENEKLERI.default;

  if (!isAdminRequest) {
    conditions.push('is_visible = true');
  }
  if (search && search.trim()) {
    // Turkce "İ" -> "i" katlamasi client'taki utils/search.js ile ayni
    // mantikla burada da yapiliyor (translate ile), yoksa "interkom" aratan
    // musteri "İnterkom Seti" adli urunu bulamaz — daha once yasanmis bir hata.
    const [katlamaFrom, katlamaTo] = sqlKatlamaParametreleri();
    values.push(katlamaFrom, katlamaTo, `%${aramaIcinNormalize(search)}%`);
    const fromIdx = values.length - 2;
    const toIdx = values.length - 1;
    const termIdx = values.length;
    conditions.push(
      `(translate(lower(name), $${fromIdx}, $${toIdx}) ILIKE $${termIdx} OR translate(lower(short_description), $${fromIdx}, $${toIdx}) ILIKE $${termIdx})`
    );
  }
  if (minPrice) {
    values.push(parseFloat(minPrice));
    conditions.push(`price >= $${values.length}`);
  }
  if (maxPrice) {
    values.push(parseFloat(maxPrice));
    conditions.push(`price <= $${values.length}`);
  }
  if (inStock === 'true') {
    conditions.push('stock_quantity > 0');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Sayfalama opsiyoneldir: page/limit gönderilmezse eski davranış gibi TÜM liste döner (geriye dönük uyumluluk).
  const usesPagination = Boolean(page || limit);
  const safeLimit = Math.min(parseInt(limit, 10) || 20, 100);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  try {
    let query = `SELECT * FROM products ${whereClause} ORDER BY ${siralama}`;
    if (usesPagination) {
      query += ` LIMIT ${safeLimit} OFFSET ${offset}`;
    }
    const result = await client.query(query, values);
    const formattedProducts = result.rows.map(p => ({ ...p, isVisible: p.is_visible }));

    if (usesPagination) {
      const countResult = await client.query(`SELECT COUNT(*) FROM products ${whereClause}`, values);
      const totalCount = parseInt(countResult.rows[0].count, 10);
      return res.json({
        products: formattedProducts,
        pagination: { page: safePage, limit: safeLimit, totalCount, totalPages: Math.ceil(totalCount / safeLimit) }
      });
    }

    res.json(formattedProducts);
  } catch (err) {
    res.status(500).json({ error: "Ürünler çekilirken hata oluştu." });
  }
});

router.post('/api/products', verifyToken, isAdmin, async (req, res) => {
  const { name, short_description, page_description, long_description, price, colors, stock_quantity, stock_by_color, technical_specs, warranty_info, images, video_url, isVisible, is_popular, badge, sort_order } = req.body;
  const safePrice = (price === "" || price === undefined) ? 0 : parseFloat(price);
  const safeSort = (sort_order === "" || sort_order === undefined) ? 0 : parseInt(sort_order, 10);
  const safeImages = Array.isArray(images) ? images.slice(0, 10) : [];
  const coverImage = safeImages[0] || null; // Geriye dönük uyumluluk: image_url = galerideki ilk görsel

  // Renkli ürünlerde: toplam stok, renklerin stoklarının TOPLAMI olarak hesaplanır.
  // Renksiz ürünlerde: eskisi gibi tek stok sayısı kullanılır.
  const hasColors = Array.isArray(colors) && colors.length > 0;
  const safeStockByColor = hasColors && stock_by_color && typeof stock_by_color === 'object' ? stock_by_color : {};
  const safeStock = hasColors
    ? Object.values(safeStockByColor).reduce((sum, n) => sum + (parseInt(n, 10) || 0), 0)
    : ((stock_quantity === "" || stock_quantity === undefined) ? 0 : parseInt(stock_quantity, 10));

  try {
    const result = await client.query(
      `INSERT INTO products 
      (name, short_description, page_description, long_description, price, colors, stock_quantity, stock_by_color, technical_specs, warranty_info, image_url, images, video_url, is_visible, is_popular, badge, sort_order) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
      [name, short_description, page_description, long_description, safePrice, JSON.stringify(colors), safeStock, JSON.stringify(safeStockByColor), JSON.stringify(technical_specs), warranty_info, coverImage, JSON.stringify(safeImages), video_url || null, isVisible, is_popular || false, badge || null, safeSort]
    );
    res.status(201).json({ ...result.rows[0], isVisible: result.rows[0].is_visible });
  } catch (err) {
    res.status(500).json({ error: "Ürün eklenemedi." });
  }
});

router.put('/api/products/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, short_description, page_description, long_description, price, colors, stock_quantity, stock_by_color, technical_specs, warranty_info, images, video_url, isVisible, is_popular, badge, sort_order } = req.body;
  const safePrice = (price === "" || price === undefined) ? 0 : parseFloat(price);
  const safeSort = (sort_order === "" || sort_order === undefined) ? 0 : parseInt(sort_order, 10);
  const safeImages = Array.isArray(images) ? images.slice(0, 10) : [];
  const coverImage = safeImages[0] || null; // Geriye dönük uyumluluk: image_url = galerideki ilk görsel

  const hasColors = Array.isArray(colors) && colors.length > 0;
  const safeStockByColor = hasColors && stock_by_color && typeof stock_by_color === 'object' ? stock_by_color : {};
  const safeStock = hasColors
    ? Object.values(safeStockByColor).reduce((sum, n) => sum + (parseInt(n, 10) || 0), 0)
    : ((stock_quantity === "" || stock_quantity === undefined) ? 0 : parseInt(stock_quantity, 10));

  try {
    const result = await client.query(
      `UPDATE products SET 
      name = $1, short_description = $2, page_description = $3, long_description = $4, price = $5, colors = $6, stock_quantity = $7, stock_by_color = $8, technical_specs = $9, warranty_info = $10, image_url = $11, images = $12, video_url = $13, is_visible = $14, is_popular = $15, badge = $16, sort_order = $17
      WHERE id = $18 RETURNING *`,
      [name, short_description, page_description, long_description, safePrice, JSON.stringify(colors), safeStock, JSON.stringify(safeStockByColor), JSON.stringify(technical_specs), warranty_info, coverImage, JSON.stringify(safeImages), video_url || null, isVisible, is_popular || false, badge || null, safeSort, id]
    );
    res.json({ ...result.rows[0], isVisible: result.rows[0].is_visible });
  } catch (err) {
    res.status(500).json({ error: "Ürün güncellenemedi." });
  }
});

// --- HIZLI GÖRÜNÜRLÜK DEĞİŞTİRME (LİSTEDEN TEK TIKLA AÇIK/GİZLİ) ---
router.patch('/api/products/:id/visibility', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { isVisible } = req.body;
  try {
    const result = await client.query(
      'UPDATE products SET is_visible = $1 WHERE id = $2 RETURNING id, is_visible',
      [isVisible, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Ürün bulunamadı." });
    res.json({ ...result.rows[0], isVisible: result.rows[0].is_visible });
  } catch (err) {
    res.status(500).json({ error: "Görünürlük güncellenemedi." });
  }
});

// --- POPÜLER DURUMU GÜNCELLEME (SADECE is_popular'ı değiştirir) ---
router.patch('/api/products/:id/popular', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_popular } = req.body;
  try {
    const result = await client.query(
      'UPDATE products SET is_popular = $1 WHERE id = $2 RETURNING id, is_popular',
      [is_popular, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Ürün bulunamadı." });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Popüler durumu güncellenemedi." });
  }
});

// --- SIRALAMA GÜNCELLEME (SADECE sort_order'ı değiştirir, diğer alanlara DOKUNMAZ) ---
// NOT: Bilerek ayrı bir rota — ürünün tüm verisini (görseller dahil) tekrar göndermeye
// gerek kalmasın diye. Böylece sıralama değiştirirken yanlışlıkla eski/güncel olmayan
// başka bir alanın üzerine yazılması riski tamamen ortadan kalkıyor.
router.patch('/api/products/:id/sort-order', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { sort_order } = req.body;
  try {
    const result = await client.query(
      'UPDATE products SET sort_order = $1 WHERE id = $2 RETURNING id, sort_order',
      [sort_order, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Ürün bulunamadı." });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Sıralama güncellenemedi." });
  }
});

router.delete('/api/products/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const silindi = await transactionIle(async (conn) => {
      // Geçmiş siparişlerdeki ürün adı/fiyatı zaten o satırda saklı (snapshot),
      // o yüzden sipariş geçmişini bozmadan sadece ürün bağlantısını kaldırıyoruz.
      await conn.query('UPDATE order_items SET product_id = NULL WHERE product_id = $1', [id]);
      // Favoriler geçmiş kaydı değil, doğrudan silinebilir.
      await conn.query('DELETE FROM favorites WHERE product_id = $1', [id]);
      const result = await conn.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
      return result.rowCount > 0;
    });

    if (!silindi) {
      return res.status(404).json({ error: "Ürün bulunamadı (zaten silinmiş olabilir)." });
    }
    res.json({ message: 'Ürün başarıyla silindi' });
  } catch (err) {
    console.error("Ürün silme hatası:", err);
    res.status(500).json({ error: "Ürün silinemedi. Sunucu loglarını kontrol edin." });
  }
});

router.get('/api/products/popular', async (req, res) => {
  try {
    const result = await client.query(
      'SELECT * FROM products WHERE is_visible = true AND is_popular = true ORDER BY sort_order ASC, id DESC'
    );
    const formattedProducts = result.rows.map(p => ({ ...p, isVisible: p.is_visible }));
    res.json(formattedProducts);
  } catch (err) {
    res.status(500).json({ error: "Popüler ürünler çekilemedi." });
  }
});

module.exports = router;
