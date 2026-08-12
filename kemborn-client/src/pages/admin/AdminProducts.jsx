import { useState, useEffect, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiSave, FiImage, FiVideo, FiShoppingCart, FiEye, FiEyeOff, FiHeart, FiTruck, FiShield, FiCheck, FiMenu, FiLoader, FiZoomIn, FiChevronLeft, FiChevronRight, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { API_URL } from '../../config/api';
import { formatPrice } from '../../utils/format';
import { temizHtml } from '../../utils/sanitize';
import { apiFetch } from '../../utils/apiFetch';
import { getToken } from '../../utils/auth';

// --- CANVAS ÜZERİNDEN KIRPILMIŞ GÖRSELİ BLOB OLARAK ÜRETEN YARDIMCI FONKSİYON ---
const getCroppedImageBlob = (imageSrc, pixelCrop) => {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d');

      // Zoom-out yapılırsa görsel kutunun tamamını doldurmayabilir; boşta kalan
      // kısımları BEYAZ ile dolduruyoruz (siyah/şeffaf yerine daha temiz durur).
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Kaynak dikdörtgenini görselin gerçek sınırlarıyla kesiştiriyoruz (taşan kısım çizilmesin)
      const sx = Math.max(0, pixelCrop.x);
      const sy = Math.max(0, pixelCrop.y);
      const sEndX = Math.min(image.width, pixelCrop.x + pixelCrop.width);
      const sEndY = Math.min(image.height, pixelCrop.y + pixelCrop.height);
      const sWidth = sEndX - sx;
      const sHeight = sEndY - sy;

      if (sWidth > 0 && sHeight > 0) {
        const dx = sx - pixelCrop.x;
        const dy = sy - pixelCrop.y;
        ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, sWidth, sHeight);
      }

      canvas.toBlob((blob) => {
        if (blob) resolve(blob); else reject(new Error('Kırpma işlemi başarısız.'));
      }, 'image/jpeg', 0.92);
    };
    image.onerror = () => reject(new Error('Görsel yüklenemedi.'));
  });
};

const MAX_GALLERY_IMAGES = 10;

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null); // Sürüklenen satırın indeksini tutar
  
  // MAĞAZA AYARLARI STATE'İ
  const [storeSettings, setStoreSettings] = useState({
    shipping_text: 'Yükleniyor...',
    warranty_badge_text: 'Yükleniyor...',
    warranty_tab_bullets: 'Yükleniyor...'
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPopularModalOpen, setIsPopularModalOpen] = useState(false);
  const [popularDraft, setPopularDraft] = useState([]); 

  const [activeTab, setActiveTab] = useState('long_description');
  const [newColor, setNewColor] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // --- GÖRSEL KIRPMA MODALI STATE'LERİ ---
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  // (Sürükle-bırak kaldırıldı — tarayıcılarda güvenilmez çalışıyordu, veri kaybına yol açabiliyordu)
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [cropTargetIndex, setCropTargetIndex] = useState(null); // null = yeni görsel ekleniyor, sayı = o index'teki görsel yeniden kırpılıyor
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  
  const [formData, setFormData] = useState({ 
    id: null,
    name: '', 
    short_description: '', 
    page_description: '',  
    price: '', 
    stock_quantity: '', 
    stock_by_color: {},
    images: [], 
    video_url: '',
    long_description: '',  
    technical_specs: '', 
    warranty_info: '1 Yıl Kemborn Türkiye Garantili', 
    colors: [], 
    isVisible: true,
    badge: '',
    sort_order: 0
  });

  // --- VERİTABANINDAN ÜRÜNLERİ VE AYARLARI ÇEKME ---
  const fetchProducts = async () => {
    try {
      const response = await apiFetch(`/api/products`);
      const data = await response.json();
      setProducts(data || []);
    } catch (error) {
      console.error('Ürün veri çekme hatası:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await apiFetch(`/api/settings`);
      const data = await response.json();
      if(data.id) setStoreSettings(data);
    } catch (error) {
      console.error('Ayarları çekme hatası:', error);
    }
  };

  // Async çağrılar effect'in içinde sarmalanıyor: react-hooks kuralı `await`in
  // arkasını göremediği için düz çağrıyı senkron bir setState sanıyor.
  // Davranış aynı, sadece kurala görünür hâle geliyor.
  useEffect(() => {
    // Promise.all: ikisi eskiden olduğu gibi paralel gitsin, biri diğerini beklemesin.
    (async () => { await Promise.all([fetchProducts(), fetchSettings()]); })();
  }, []);

  // --- NATIVE DRAG & DROP SIRALAMA FONKSİYONLARI ---
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Bırakmaya (Drop) izin vermek için gerekli
  };

  const handleDrop = async (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    // Satırların sırasını dizide değiştiriyoruz
    const updatedList = [...products];
    const [draggedItem] = updatedList.splice(draggedIndex, 1);
    updatedList.splice(targetIndex, 0, draggedItem);

    // Yeni sıralamaya göre sort_order değerlerini ardışık güncelliyoruz
    const finalizedList = updatedList.map((product, idx) => ({
      ...product,
      sort_order: idx + 1
    }));

    // Ön yüzde anlık (optimistic) güncelleme yaparak akıcılık sağlıyoruz
    setProducts(finalizedList);
    setDraggedIndex(null);

    // GÜVENLİ: Sadece sort_order'ı güncelliyoruz (ürünün tüm verisini,
    // görseller dahil, tekrar göndermiyoruz — böylece başka bir yerde
    // yapılan güncel bir değişikliğin üzerine yanlışlıkla yazılmaz).
    try {
      await Promise.all(finalizedList.map(p =>
        apiFetch(`/api/products/${p.id}/sort-order`, {
          method: 'PATCH',
          body: JSON.stringify({ sort_order: p.sort_order })
        })
      ));
    } catch (error) {
      console.error("Yeni sıralama veritabanına işlenemedi:", error);
    }
  };

  // --- MOBİLDE OK BUTONLARIYLA SIRALAMA (dokunmatik ekranlarda sürükle-bırak güvenilir çalışmıyor) ---
  const handleMoveProduct = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= products.length) return;

    const updatedList = [...products];
    [updatedList[index], updatedList[targetIndex]] = [updatedList[targetIndex], updatedList[index]];
    const finalizedList = updatedList.map((product, idx) => ({ ...product, sort_order: idx + 1 }));

    setProducts(finalizedList);

    try {
      await Promise.all([updatedList[index], updatedList[targetIndex]].map(p =>
        apiFetch(`/api/products/${p.id}/sort-order`, {
          method: 'PATCH',
          body: JSON.stringify({ sort_order: p.sort_order })
        })
      ));
    } catch (error) {
      console.error("Sıralama güncellenemedi:", error);
    }
  };

  // --- ÜRÜN EKLEME/DÜZENLEME MODALI ---
  const openModal = (product = null) => {
    setFormData({
      id: product?.id || null,
      name: product?.name || '',
      short_description: product?.short_description || '',
      page_description: product?.short_description || product?.page_description || '',
      price: product?.price || '',
      stock_quantity: product?.stock_quantity ?? 10,
      stock_by_color: (product?.stock_by_color && typeof product.stock_by_color === 'object') ? product.stock_by_color : {},
      images: Array.isArray(product?.images) ? product.images : (product?.image_url ? [product.image_url] : []),
      video_url: product?.video_url || '',
      long_description: product?.long_description || '',
      technical_specs: product?.technical_specs || '',
      warranty_info: product?.warranty_info || '1 Yıl Kemborn Türkiye Garantili',
      colors: product?.colors || [],
      isVisible: product?.isVisible ?? true,
      badge: product?.badge || '',
      sort_order: product?.sort_order ?? 0               
    });
    setIsModalOpen(true);
  };

  const addColor = (e) => {
    e.preventDefault();
    const trimmed = newColor.trim();
    if (trimmed && !formData.colors.includes(trimmed)) {
      setFormData({
        ...formData,
        colors: [...formData.colors, trimmed],
        stock_by_color: { ...formData.stock_by_color, [trimmed]: formData.stock_by_color[trimmed] ?? 0 }
      });
      setNewColor('');
    }
  };

  const removeColor = (colorToRemove) => {
    const updatedStockByColor = { ...formData.stock_by_color };
    delete updatedStockByColor[colorToRemove];
    setFormData({
      ...formData,
      colors: formData.colors.filter(color => color !== colorToRemove),
      stock_by_color: updatedStockByColor
    });
  };

  const updateColorStock = (color, value) => {
    const safeValue = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
    setFormData(prev => ({ ...prev, stock_by_color: { ...prev.stock_by_color, [color]: safeValue } }));
  };

  // --- FİYAT: TL / KURUŞ AYRI GİRİŞ YARDIMCILARI ---
  // Kafa karıştıran "740.5 mi 740,50 mi" belirsizliğini önlemek için fiyat, TL (tam sayı) ve
  // Kuruş (00-99) olarak iki ayrı kutuya bölünüyor, arka planda tek bir ondalıklı sayı olarak birleştiriliyor.
  const getLiraPart = (price) => {
    const num = parseFloat(price) || 0;
    return Math.floor(num).toString();
  };
  const getKurusPart = (price) => {
    const num = parseFloat(price) || 0;
    const kurus = Math.round((num - Math.floor(num)) * 100);
    return kurus.toString().padStart(2, '0');
  };
  const updatePriceLira = (liraValue) => {
    const cleanLira = liraValue.replace(/\D/g, '');
    const kurus = getKurusPart(formData.price);
    setFormData(prev => ({ ...prev, price: `${cleanLira || '0'}.${kurus}` }));
  };
  const updatePriceKurus = (kurusValue) => {
    const cleanKurus = kurusValue.replace(/\D/g, '').slice(0, 2);
    const lira = getLiraPart(formData.price);
    setFormData(prev => ({ ...prev, price: `${lira || '0'}.${cleanKurus.padStart(2, '0')}` }));
  };

  // --- ÜRÜN KAYDETME FONKSİYONU ---
  const handleSave = async () => {
    if (!getToken()) {
      alert("HATA: Oturum token'ı bulunamadı! Lütfen tekrar giriş yapın.");
      return;
    }

    // KRİTİK KONTROL: Bir görsel/video hâlâ sunucuya yükleniyorsa (kırpıp
    // "Kırp ve Ekle" dedikten hemen sonra) kaydetmeyi engelle. Yoksa henüz
    // formData'ya eklenmemiş olan görsel/video sessizce kaybolur.
    if (isUploadingImage || isUploadingVideo) {
      alert("Lütfen bekleyin: bir görsel/video hâlâ sunucuya yükleniyor. Yükleme bitmeden (sayaç güncellenmeden) kaydetmeyin.");
      return;
    }

    const payload = {
      ...formData,
      price: formData.price !== "" ? parseFloat(formData.price) : 0,
      stock_quantity: formData.stock_quantity !== "" ? parseInt(formData.stock_quantity, 10) : 0,
      sort_order: formData.sort_order !== "" ? parseInt(formData.sort_order, 10) : 0
    };

    // 🔍 TEŞHİS LOGU: formData ve payload'daki gerçek görsel sayısını konsola yazdır
    console.log('🔍 [KAYDET] formData.images:', formData.images.length, formData.images);
    console.log('🔍 [KAYDET] payload.images:', payload.images.length, payload.images);

    if (!payload.id) {
      delete payload.id;
    }

    try {
      const method = payload.id ? 'PUT' : 'POST';
      const url = payload.id 
        ? `${API_URL}/api/products/${payload.id}` 
        : `${API_URL}/api/products`;

      console.log('🔍 [KAYDET] Gönderilen istek gövdesi (body):', JSON.parse(JSON.stringify(payload)).images);

      const response = await apiFetch(url, {
        method: method,
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const savedProduct = await response.json();
        console.log('🔍 [KAYDET] Sunucudan dönen cevaptaki images:', savedProduct.images?.length, savedProduct.images);
        // Arka planda tekrar çekmek yerine (yarış durumu riski taşır),
        // az önce kaydedilen veriyi DOĞRUDAN state'e yazıyoruz.
        setProducts(prev => {
          const exists = prev.some(p => p.id === savedProduct.id);
          return exists
            ? prev.map(p => p.id === savedProduct.id ? savedProduct : p)
            : [savedProduct, ...prev];
        });
        alert("İşlem Başarılı! Ürün veritabanına kaydedildi.");
        setIsModalOpen(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        const serverErrorMessage = errorData.message || errorData.error || "Validasyon Hatası";
        alert(`Kaydetme Başarısız!\n\nSunucudan Dönen Hata: "${serverErrorMessage}"`);
      }
    } catch (error) {
      console.error("Bağlantı hatası:", error);
      alert("Sunucuya bağlanılamadı. API sunucunuzun ayakta olduğundan emin olun.");
    }
  };

  // --- BİLGİSAYARDAN VİDEO YÜKLEME ---
  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!getToken()) {
      alert("HATA: Oturum token'ı bulunamadı! Lütfen tekrar giriş yapın.");
      return;
    }

    setIsUploadingVideo(true);
    const body = new FormData();
    body.append('video', file);

    try {
      const response = await apiFetch(`/api/upload`, {
        method: 'POST',
        body
      });
      const data = await response.json();

      if (response.ok) {
        setFormData(prev => {
          deleteServerFile(prev.video_url); // Değiştiriliyorsa eski videoyu diskten temizle
          return { ...prev, video_url: data.video_url };
        });
      } else {
        alert(`Yükleme Başarısız!\n\n${data.error || 'Bilinmeyen hata.'}`);
      }
    } catch (error) {
      console.error("Video yükleme hatası:", error);
      alert("Sunucuya bağlanılamadı. Video yüklenemedi.");
    } finally {
      setIsUploadingVideo(false);
      e.target.value = '';
    }
  };

  // --- GÖRSEL SEÇİLDİĞİNDE KIRPMA MODALINI AÇAR (YENİ GÖRSEL EKLEME) ---
  const handleImageFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (formData.images.length >= MAX_GALLERY_IMAGES) {
      alert(`En fazla ${MAX_GALLERY_IMAGES} görsel ekleyebilirsiniz.`);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result);
      setCropTargetIndex(null); // Yeni görsel ekleniyor
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Aynı dosyayı tekrar seçebilmek için input'u sıfırla
  };

  // --- GALERİDEKİ MEVCUT BİR GÖRSELİ TEKRAR KIRPMAK İÇİN AÇAR ---
  const handleReCropExisting = (index) => {
    setCropImageSrc(formData.images[index]);
    setCropTargetIndex(index); // Bu index'teki görsel değiştirilecek
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCropModalOpen(true);
  };

  const onCropComplete = useCallback((_croppedArea, croppedAreaPixelsValue) => {
    setCroppedAreaPixels(croppedAreaPixelsValue);
  }, []);

  // --- KIRPILAN GÖRSELİ SUNUCUYA YÜKLEYİP GALERİYE EKLER YA DA MEVCUDUNU DEĞİŞTİRİR ---
  // --- ARTIK KULLANILMAYAN BİR DOSYAYI SUNUCUDAN SİLER (yetim dosya birikmesin diye) ---
  // "Best effort": başarısız olsa bile kullanıcı akışını durdurmaz, sadece konsola not düşer.
  const deleteServerFile = (url) => {
    if (!url) return;
    apiFetch(`/api/upload`, {
      method: 'DELETE',
      body: JSON.stringify({ url })
    }).catch(err => console.warn('Eski dosya silinemedi (önemli değil):', err));
  };

  const handleConfirmCrop = async () => {
    if (!croppedAreaPixels || !cropImageSrc) return;
    if (!getToken()) {
      alert("HATA: Oturum token'ı bulunamadı! Lütfen tekrar giriş yapın.");
      return;
    }

    setIsUploadingImage(true);
    try {
      const blob = await getCroppedImageBlob(cropImageSrc, croppedAreaPixels);
      const body = new FormData();
      body.append('image', blob, `urun-${Date.now()}.jpg`);

      const response = await apiFetch(`/api/upload`, {
        method: 'POST',
        body
      });
      const data = await response.json();

      if (response.ok) {
        setFormData(prev => {
          if (cropTargetIndex !== null) {
            // Mevcut görseli yenisiyle değiştir; eski dosyayı diskten temizle
            const oldUrl = prev.images[cropTargetIndex];
            deleteServerFile(oldUrl);
            const updatedImages = [...prev.images];
            updatedImages[cropTargetIndex] = data.image_url;
            return { ...prev, images: updatedImages };
          }
          // Yeni görsel olarak galeriye ekle
          return { ...prev, images: [...prev.images, data.image_url] };
        });
        setCropModalOpen(false);
        setCropImageSrc(null);
        setCropTargetIndex(null);
      } else {
        alert(`Yükleme Başarısız!\n\n${data.error || 'Bilinmeyen hata.'}`);
      }
    } catch (error) {
      console.error("Görsel kırpma/yükleme hatası:", error);
      alert("Görsel işlenemedi veya sunucuya yüklenemedi. (Farklı bir siteden alınmış görseller kırpma için tekrar yüklenemeyebilir.)");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = (index) => {
    setFormData(prev => {
      deleteServerFile(prev.images[index]);
      return { ...prev, images: prev.images.filter((_, i) => i !== index) };
    });
  };

  // --- GÖRSEL GALERİSİNDE YUKARI/AŞAĞI OK İLE SIRALAMA (güvenilir, veri kaybettirmez) ---
  const handleMoveImage = (index, direction) => {
    const targetIndex = index + direction;
    setFormData(prev => {
      if (targetIndex < 0 || targetIndex >= prev.images.length) return prev;
      const updated = [...prev.images];
      [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
      return { ...prev, images: updated };
    });
  };

  // --- ÜRÜN SİLME FONKSİYONU ---
  const handleDelete = async (product) => {
    if (!getToken()) {
      alert("HATA: Oturum token'ı bulunamadı! Lütfen tekrar giriş yapın.");
      return;
    }
    if (!window.confirm(`"${product.name}" adlı ürünü kalıcı olarak silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.`)) {
      return;
    }

    setDeletingId(product.id);
    try {
      const response = await apiFetch(`/api/products/${product.id}`, { method: 'DELETE' });
      if (response.ok) {
        setProducts(prev => prev.filter(p => p.id !== product.id));
        // Ürünle birlikte görsellerini/videosunu da diskten temizle (best-effort)
        (Array.isArray(product.images) ? product.images : []).forEach(deleteServerFile);
        if (product.video_url) deleteServerFile(product.video_url);
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Silinemedi!\n\n${errorData.error || 'Bilinmeyen hata.'}`);
      }
    } catch (error) {
      console.error("Ürün silme hatası:", error);
      alert("Sunucuya bağlanılamadı. Ürün silinemedi.");
    } finally {
      setDeletingId(null);
    }
  };

  // --- LİSTEDEN TEK TIKLA AÇIK/GİZLİ DEĞİŞTİRME ---
  const handleToggleVisibility = async (product) => {
    if (!getToken()) {
      alert("HATA: Oturum token'ı bulunamadı! Lütfen tekrar giriş yapın.");
      return;
    }

    const nextVisible = !product.isVisible;
    setTogglingId(product.id);
    // Anlık (optimistic) güncelleme
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isVisible: nextVisible, is_visible: nextVisible } : p));

    try {
      const response = await apiFetch(`/api/products/${product.id}/visibility`, {
        method: 'PATCH',
        body: JSON.stringify({ isVisible: nextVisible })
      });
      if (!response.ok) throw new Error("Güncellenemedi");
    } catch (error) {
      console.error("Görünürlük değiştirme hatası:", error);
      alert("Görünürlük değiştirilemedi, eski durum geri yüklendi.");
      // Hata durumunda geri al
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isVisible: product.isVisible, is_visible: product.isVisible } : p));
    } finally {
      setTogglingId(null);
    }
  };


  const popularProducts = products.filter(p => p.is_popular);

  const openPopularModal = () => {
    setPopularDraft(products.filter(p => p.is_popular).map(p => p.id));
    setIsPopularModalOpen(true);
  };

  const togglePopularDraft = (productId) => {
    if (popularDraft.includes(productId)) {
      setPopularDraft(popularDraft.filter(id => id !== productId));
    } else {
      if (popularDraft.length >= 4) {
        alert("Maksimum 4 adet popüler model seçebilirsiniz!");
        return;
      }
      setPopularDraft([...popularDraft, productId]);
    }
  };

  const handleSavePopularVitrin = async () => {
    if (!getToken()) {
      alert("HATA: Oturum bulunamadı! Lütfen tekrar giriş yapın.");
      return;
    }

    if (popularDraft.length === 0) {
      if (!window.confirm("Hiç popüler ürün seçmediniz. Ana sayfadaki 'Popüler Modeller' bölümü boş görünecek. Devam etmek istiyor musunuz?")) {
        return;
      }
    }

    const changedProducts = products.filter(p => {
      const wasPopular = p.is_popular;
      const isNowPopular = popularDraft.includes(p.id);
      return wasPopular !== isNowPopular;
    });

    if (changedProducts.length === 0) {
      setIsPopularModalOpen(false);
      return;
    }

    try {
      await Promise.all(changedProducts.map(async (p) => {
        const nowPopular = popularDraft.includes(p.id);
        const res = await apiFetch(`/api/products/${p.id}/popular`, {
          method: 'PATCH',
          body: JSON.stringify({ is_popular: nowPopular })
        });
        if (!res.ok) throw new Error("Popüler ürün güncellenemedi.");
        return { id: p.id, is_popular: nowPopular };
      })).then(updates => {
        // Yerel state'i de tek tek güncelliyoruz (tam ürünü tekrar çekmeye gerek yok)
        setProducts(prev => prev.map(prod => {
          const update = updates.find(u => u.id === prod.id);
          return update ? { ...prod, is_popular: update.is_popular } : prod;
        }));
      });
      
      setIsPopularModalOpen(false);
      alert("Popüler modeller başarıyla güncellendi!");
    } catch (error) {
      console.error("Popüler modeller kaydedilemedi:", error);
      alert("Güncellenirken bir hata oluştu.");
    }
  };

  const isOutOfStock = parseInt(formData.stock_quantity || 0) <= 0;
  const inlineInputClass = "w-full bg-zinc-50/70 border-b-2 border-dashed border-zinc-300 hover:border-cyan-500 focus:border-cyan-600 focus:bg-cyan-50/50 outline-none transition-all rounded-t-md px-1.5 py-0.5 cursor-text";

  return (
    <div className="animate-in fade-in duration-500">
      
      {/* ÜST BAR CONTROLLERİ */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900">Ürün Yönetimi</h1>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <div 
            onClick={openPopularModal}
            className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm h-[60px] cursor-pointer hover:border-cyan-500 hover:shadow-md transition-all group animate-in slide-in-from-right duration-500"
            title="Popüler modelleri düzenlemek için tıklayın"
          >
            <div className="text-[10px] font-black text-zinc-400 group-hover:text-cyan-600 transition-colors uppercase tracking-widest px-2 leading-tight text-right">
              Popüler<br/>Modeller
            </div>
            <div className="flex gap-2 h-full">
              {[0, 1, 2, 3].map((index) => {
                const popProduct = popularProducts[index];
                return (
                  <div key={index} className={`w-[42px] h-[42px] rounded-xl flex items-center justify-center overflow-hidden transition-all border-2 ${popProduct ? 'border-amber-400 bg-amber-50 shadow-sm' : 'border-dashed border-zinc-200 bg-zinc-50 group-hover:border-cyan-300 group-hover:bg-cyan-50'}`}>
                    {popProduct ? (
                      popProduct.image_url 
                        ? <img src={popProduct.image_url} alt={popProduct.name} className="w-full h-full object-cover" /> 
                        : <FiHeart className="text-amber-500 fill-amber-500" size={14} />
                    ) : (
                      <FiPlus className="text-zinc-300 group-hover:text-cyan-400" size={16} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={() => openModal()} className="flex items-center justify-center gap-2 bg-cyan-600 text-white px-6 h-[60px] rounded-2xl font-bold hover:bg-cyan-700 transition-all shadow-sm">
            <FiPlus size={20} /> Yeni Ürün Ekle
          </button>
        </div>
      </div>

      {/* ANA TABLO — MASAÜSTÜ (md ve üzeri) */}
      <div className="hidden md:block bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left table-fixed min-w-[720px]">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="p-6 font-black text-zinc-400 uppercase text-xs w-20 text-center">Sıra</th>
              <th className="p-6 font-black text-zinc-400 uppercase text-xs w-[40%]">Ürün Adı</th>
              <th className="p-6 font-black text-zinc-400 uppercase text-xs w-[20%]">Fiyat</th>
              <th className="p-6 font-black text-zinc-400 uppercase text-xs w-[15%]">Stok</th>
              <th className="p-6 font-black text-zinc-400 uppercase text-xs w-[15%]">Görünürlük</th>
              <th className="p-6 font-black text-zinc-400 uppercase text-xs text-right w-[10%] whitespace-nowrap">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {products.map((product, index) => (
              <tr 
                key={product.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                className="hover:bg-zinc-50/80 transition-colors cursor-grab active:cursor-grabbing select-none group"
              >
                {/* TUTMA/KAYDIRMA IKONU COLUMN */}
                <td className="p-6 text-center">
                  <div className="flex items-center justify-center text-zinc-300 group-hover:text-cyan-600 transition-colors">
                    <FiMenu size={20} />
                  </div>
                </td>

                <td className="p-6 font-bold text-zinc-900 truncate">{product.name}</td>
                <td className="p-6 text-zinc-900 font-black">{formatPrice(product.price)} TL</td>
                <td className="p-6">
                  {/* Stoğu azalan ürünler burada da uyarı rengiyle işaretleniyor —
                      dashboard "stok azaldı" diyor, hangi ürün olduğu buradan görünsün. */}
                  <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                    product.stock_quantity > 0
                      ? (product.stock_quantity <= 5 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-600')
                      : 'bg-red-50 text-red-600'
                  }`}>
                    {product.stock_quantity > 0 ? `${product.stock_quantity} Adet` : 'Stokta Yok'}
                    {product.stock_quantity > 0 && product.stock_quantity <= 5 && ' · Az kaldı'}
                  </span>
                </td>
                <td className="p-6">
                   <button
                     onClick={(e) => { e.stopPropagation(); handleToggleVisibility(product); }}
                     disabled={togglingId === product.id}
                     className={`flex items-center gap-1 font-bold transition-opacity ${togglingId === product.id ? 'opacity-40 cursor-wait' : 'hover:opacity-70 cursor-pointer'} ${product.isVisible ? 'text-zinc-600' : 'text-red-500'}`}
                     title="Tıklayarak açık/gizli durumunu değiştir"
                   >
                     {product.isVisible ? <FiEye/> : <FiEyeOff/>} {product.isVisible ? 'Açık' : 'Gizli'}
                   </button>
                </td>
                <td className="p-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => openModal(product)} 
                      className="p-2 bg-zinc-100 rounded-xl hover:bg-cyan-100 hover:text-cyan-700 transition-all inline-block"
                    >
                      <FiEdit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(product)} 
                      disabled={deletingId === product.id}
                      className={`p-2 bg-zinc-100 rounded-xl hover:bg-red-100 hover:text-red-600 transition-all inline-block ${deletingId === product.id ? 'opacity-40 cursor-wait' : ''}`}
                      title="Ürünü sil"
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ÜRÜN KARTLARI — MOBİL (md altı, tabloya alternatif) */}
      <div className="md:hidden space-y-3">
        {products.map((product, index) => (
          <div key={product.id} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-zinc-900 truncate">{product.name}</h3>
                <p className="text-lg font-black text-cyan-700">{formatPrice(product.price)} TL</p>
              </div>
              {/* Sıralama okları: mobilde parmakla basılabilmesi için 44x44
                  dokunma alanına çıkarıldı (önceden 28x28 idi ve iki buton
                  birbirine çok yakın olduğu için yanlış basılıyordu). */}
              <div className="flex flex-col items-end shrink-0">
                <button
                  onClick={() => handleMoveProduct(index, -1)}
                  disabled={index === 0}
                  className="w-11 h-11 flex items-center justify-center bg-zinc-100 rounded-lg disabled:opacity-30 text-zinc-600 active:bg-zinc-200"
                  aria-label="Ürünü yukarı taşı"
                  title="Yukarı taşı"
                >
                  <FiChevronUp size={20} />
                </button>
                <button
                  onClick={() => handleMoveProduct(index, 1)}
                  disabled={index === products.length - 1}
                  className="w-11 h-11 mt-1.5 flex items-center justify-center bg-zinc-100 rounded-lg disabled:opacity-30 text-zinc-600 active:bg-zinc-200"
                  aria-label="Ürünü aşağı taşı"
                  title="Aşağı taşı"
                >
                  <FiChevronDown size={20} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mb-1">
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                product.stock_quantity > 0
                  ? (product.stock_quantity <= 5 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-600')
                  : 'bg-red-50 text-red-600'
              }`}>
                {product.stock_quantity > 0 ? `${product.stock_quantity} Adet` : 'Stokta Yok'}
                {product.stock_quantity > 0 && product.stock_quantity <= 5 && ' · Az kaldı'}
              </span>
              {/* Görünürlük düğmesi de 44px yüksekliğe çıkarıldı */}
              <button
                onClick={() => handleToggleVisibility(product)}
                disabled={togglingId === product.id}
                className={`flex items-center gap-1.5 px-3 h-11 rounded-xl font-bold text-sm active:bg-zinc-100 ${togglingId === product.id ? 'opacity-40' : ''} ${product.isVisible ? 'text-zinc-600' : 'text-red-500'}`}
                aria-label={product.isVisible ? 'Ürünü gizle' : 'Ürünü satışa aç'}
              >
                {product.isVisible ? <FiEye size={18}/> : <FiEyeOff size={18}/>} {product.isVisible ? 'Açık' : 'Gizli'}
              </button>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-zinc-100">
              <button
                onClick={() => openModal(product)}
                className="flex-1 flex items-center justify-center gap-2 min-h-[44px] bg-zinc-100 rounded-xl font-bold text-sm text-zinc-700 active:bg-zinc-200"
              >
                <FiEdit2 size={16} /> Düzenle
              </button>
              <button
                onClick={() => handleDelete(product)}
                disabled={deletingId === product.id}
                className={`flex items-center justify-center gap-2 min-h-[44px] px-4 bg-red-50 text-red-600 rounded-xl font-bold text-sm active:bg-red-100 ${deletingId === product.id ? 'opacity-40' : ''}`}
              >
                <FiTrash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* POPÜLER MODELLER SEÇİM MODALI */}
      {isPopularModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden max-h-[80vh]">
            <div className="flex justify-between items-center p-6 border-b border-zinc-100">
              <div>
                <h2 className="text-2xl font-black text-zinc-900">Popüler Modeller</h2>
                <p className="text-sm text-zinc-500 mt-1">Ana sayfada sergilenecek en fazla 4 popüler ürün seçin (1, 2 veya 3 tane de seçebilirsiniz). ({popularDraft.length}/4 Seçildi)</p>
              </div>
              <button onClick={() => setIsPopularModalOpen(false)} className="p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 rounded-xl transition-all">
                <FiX size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 gap-3 bg-zinc-50">
              {products.map((product) => {
                const isSelected = popularDraft.includes(product.id);
                const isDisabled = !isSelected && popularDraft.length >= 4;

                return (
                  <div 
                    key={product.id} 
                    onClick={() => !isDisabled && togglePopularDraft(product.id)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                      isSelected 
                        ? 'border-cyan-500 bg-cyan-50 shadow-sm cursor-pointer' 
                        : isDisabled 
                          ? 'border-zinc-100 bg-white opacity-50 cursor-not-allowed' 
                          : 'border-transparent bg-white hover:border-zinc-300 hover:shadow-sm cursor-pointer'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-zinc-100 overflow-hidden shrink-0">
                      {product.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover"/> : <FiImage className="w-full h-full p-3 text-zinc-300" />}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-zinc-900">{product.name}</h3>
                      <p className="text-xs text-zinc-500">{formatPrice(product.price)} TL</p>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isSelected ? 'bg-cyan-500 border-cyan-500 text-white' : 'border-zinc-200 text-transparent'}`}>
                      <FiCheck size={16} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="p-6 border-t border-zinc-100 bg-white flex justify-end gap-3">
              <button onClick={() => setIsPopularModalOpen(false)} className="px-6 py-2.5 font-bold text-zinc-500 hover:text-zinc-900 transition-colors">İptal</button>
              <button onClick={handleSavePopularVitrin} className="flex items-center gap-2 bg-zinc-900 text-white px-8 py-2.5 rounded-xl font-black hover:bg-cyan-600 transition-all shadow-sm">
                <FiSave /> Popülerleri Güncelle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ÜRÜN EKLEME / DÜZENLEME MODALI */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-[100rem] h-[95vh] flex flex-col shadow-2xl overflow-hidden">
            
            <div className="flex flex-wrap justify-between items-center gap-3 p-4 sm:p-6 border-b border-zinc-100 bg-white z-20 shrink-0">
              <h2 className="text-lg sm:text-2xl font-black text-zinc-900">
                {formData.id ? 'Ürün Düzenleme' : 'Yeni Ürün'}
              </h2>
              <div className="flex items-center gap-2 sm:gap-4">
                <button onClick={() => setIsModalOpen(false)} className="px-3 sm:px-6 py-2.5 font-bold text-sm sm:text-base text-zinc-500 hover:text-zinc-900 transition-colors">İptal</button>
                <button
                  onClick={handleSave}
                  disabled={isUploadingImage || isUploadingVideo}
                  className={`flex items-center gap-2 px-4 sm:px-8 py-2.5 rounded-xl font-black text-sm sm:text-base transition-all shadow-sm ${
                    isUploadingImage || isUploadingVideo
                      ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                      : 'bg-zinc-900 text-white hover:bg-cyan-600'
                  }`}
                >
                  {isUploadingImage || isUploadingVideo ? (
                    <><FiLoader className="animate-spin" /> <span className="hidden sm:inline">Yükleniyor, bekleyin...</span></>
                  ) : (
                    <><FiSave /> Kaydet</>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-zinc-50 p-4 border-b border-zinc-200 shrink-0 flex flex-wrap gap-4 items-center justify-between z-10 relative shadow-sm">
              <div className="flex flex-1 items-center gap-4 flex-wrap">
                {/* Modal İçi Sıralama Kutusu Girişi */}
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-zinc-200 shadow-sm shrink-0">
                  <label className="text-xs font-bold text-zinc-500 uppercase whitespace-nowrap">Vitrin Sırası:</label>
                  <input 
                    type="number" 
                    className="w-12 font-black outline-none text-zinc-900 text-sm bg-transparent" 
                    value={formData.sort_order} 
                    onChange={e => setFormData({...formData, sort_order: e.target.value})} 
                  />
                </div>

                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-zinc-200 shadow-sm shrink-0">
                  <label className="text-xs font-bold text-zinc-500 uppercase whitespace-nowrap">Kart Rozeti:</label>
                  <input 
                    type="text" 
                    placeholder="Örn: Çok Satan, Yeni" 
                    className="w-28 font-black outline-none text-zinc-900 text-sm placeholder:text-zinc-300 bg-transparent" 
                    value={formData.badge} 
                    onChange={e => setFormData({...formData, badge: e.target.value})} 
                  />
                </div>

                <button onClick={() => setFormData({...formData, isVisible: !formData.isVisible})} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 ${formData.isVisible ? 'bg-white border border-zinc-200 text-zinc-900 shadow-sm' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {formData.isVisible ? <FiEye size={16}/> : <FiEyeOff size={16}/>}
                  {formData.isVisible ? 'Müşterilere Açık' : 'Müşterilerden Gizli'}
                </button>

                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-zinc-200 shadow-sm shrink-0">
                  <label className="text-xs font-bold text-zinc-500 uppercase whitespace-nowrap">
                    {formData.colors.length > 0 ? 'Toplam Stok:' : 'Stok Adedi:'}
                  </label>
                  {formData.colors.length > 0 ? (
                    <span className="w-16 font-black text-zinc-900" title="Renk stoklarının toplamı, aşağıdan renklere göre düzenlenir">
                      {Object.values(formData.stock_by_color).reduce((sum, n) => sum + (parseInt(n, 10) || 0), 0)}
                    </span>
                  ) : (
                    <input type="number" className="w-16 font-black outline-none text-zinc-900" value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: e.target.value})} />
                  )}
                </div>
              </div>

              <button
                onClick={() => setIsMediaModalOpen(true)}
                className="flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 hover:bg-cyan-600 transition-all shadow-sm"
              >
                <FiImage size={16} />
                Görüntü Ayarları
                <span className="bg-white/20 px-2 py-0.5 rounded-md text-xs">
                  {formData.images.length}/{MAX_GALLERY_IMAGES}{formData.video_url ? ' + video' : ''}
                </span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-zinc-100/50 p-3 sm:p-6 flex flex-col xl:flex-row gap-8">
              
              <div className="w-full xl:w-1/3 flex flex-col items-center">
                <div className="mb-4 text-xs font-black text-zinc-400 tracking-widest uppercase text-center w-full">VİTRİN KARTI</div>
                <div className="bg-white rounded-[2rem] p-4 w-full max-w-sm shadow-xl border border-zinc-100 transition-all relative">
                  {!formData.isVisible && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center rounded-[2rem] border-2 border-red-200">
                      <FiEyeOff size={32} className="text-red-500 mb-2"/>
                      <span className="font-black text-red-500">MÜŞTERİDEN GİZLİ</span>
                    </div>
                  )}
                  <div className="bg-zinc-50 rounded-[1.5rem] aspect-[4/5] mb-6 flex items-center justify-center overflow-hidden relative border border-zinc-100">
                    {formData.badge && (
                      <span className="absolute top-4 left-4 bg-zinc-900 text-white text-[10px] font-black px-2.5 py-1.5 rounded-full z-10 shadow-sm uppercase tracking-wider">
                        {formData.badge}
                      </span>
                    )}
                    {formData.images[0] ? <img src={formData.images[0]} alt="Önizleme" className="w-full h-full object-cover" /> : <span className="text-zinc-300 font-bold text-sm">Görsel Yok</span>}
                  </div>
                  <div className="px-2 pb-2">
                    <input className={`text-2xl font-black text-zinc-900 mb-1 ${inlineInputClass}`} placeholder="Ürün Adı" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-wider mt-2 mb-1">Ürün Açıklaması (kart ve detay sayfasında aynı görünür)</label>
                    <textarea className={`appearance-none text-zinc-500 text-sm leading-snug mb-3 h-12 resize-none ${inlineInputClass}`} placeholder="Ürün açıklaması..." value={formData.short_description} onChange={e => setFormData({...formData, short_description: e.target.value, page_description: e.target.value})} />
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <div className="flex items-baseline gap-1 shrink-0 min-w-0">
                        <input type="text" inputMode="numeric" className={`text-2xl font-black w-14 text-right text-cyan-700 shrink-0 ${inlineInputClass}`} placeholder="0" value={getLiraPart(formData.price)} onChange={e => updatePriceLira(e.target.value)} />
                        <span className="text-2xl font-black text-cyan-700 shrink-0 whitespace-nowrap">,</span>
                        <input type="text" inputMode="numeric" className={`text-lg font-black w-10 text-cyan-700 shrink-0 ${inlineInputClass}`} placeholder="00" value={getKurusPart(formData.price)} onChange={e => updatePriceKurus(e.target.value)} />
                        <span className="text-2xl font-black text-cyan-700 ml-1 shrink-0 whitespace-nowrap">TL</span>
                      </div>
                      <button className={`p-3 rounded-xl transition-all shrink-0 ${isOutOfStock ? 'bg-zinc-100 text-zinc-300 cursor-not-allowed' : 'bg-zinc-900 text-white hover:bg-cyan-600'}`}>
                        <FiShoppingCart size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full xl:w-2/3 flex flex-col items-center">
                <div className="mb-4 text-xs font-black text-zinc-400 tracking-widest uppercase text-center w-full">ÜRÜN DETAY SAYFASI</div>
                <div className="w-full max-w-4xl bg-white p-4 sm:p-8 rounded-[2rem] shadow-xl border border-zinc-100 relative">
                  {!formData.isVisible && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center rounded-[2rem] border-2 border-red-200">
                      <FiEyeOff size={48} className="text-red-500 mb-2"/>
                      <span className="font-black text-red-500 text-2xl tracking-widest">BU SAYFA ŞU AN KAPALI</span>
                    </div>
                  )}
                  <div className="flex flex-col md:flex-row gap-10 mb-10">
                    <div className="w-full md:w-1/2 aspect-[4/5] bg-zinc-50 rounded-[2rem] border border-zinc-100 flex items-center justify-center overflow-hidden relative">
                      {formData.images[0] ? <img src={formData.images[0]} alt="Ürün" className="w-full h-full object-cover" /> : <span className="text-zinc-300 font-bold text-sm">Ürün Görseli</span>}
                    </div>
                    <div className="w-full md:w-1/2 flex flex-col justify-start">
                      <input className={`text-4xl font-black text-zinc-900 mb-2 ${inlineInputClass}`} placeholder="Ürün Adı" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                      <div className="flex items-baseline gap-2 mb-6 flex-wrap">
                        <input type="text" inputMode="numeric" className={`text-2xl font-black w-16 text-right text-cyan-600 shrink-0 ${inlineInputClass}`} placeholder="0" value={getLiraPart(formData.price)} onChange={e => updatePriceLira(e.target.value)} />
                        <span className="text-2xl font-black text-cyan-600 shrink-0 whitespace-nowrap">,</span>
                        <input type="text" inputMode="numeric" className={`text-lg font-black w-10 text-cyan-600 shrink-0 ${inlineInputClass}`} placeholder="00" value={getKurusPart(formData.price)} onChange={e => updatePriceKurus(e.target.value)} />
                        <span className="text-2xl font-black text-cyan-600 shrink-0 whitespace-nowrap">TL</span>
                      </div>
                      <textarea className={`appearance-none text-zinc-500 text-sm leading-relaxed mb-6 h-20 resize-none ${inlineInputClass}`} placeholder="Ürün açıklaması..." value={formData.short_description} onChange={e => setFormData({...formData, short_description: e.target.value, page_description: e.target.value})} />
                      <div className="mb-6 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                            Renk Seçimi: <span className="text-cyan-600">{formData.colors[0] || 'Eklenmedi'}</span>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {formData.colors.map((color, i) => (
                            <div key={i} className={`flex items-center gap-2 pl-4 pr-2 py-1.5 rounded-xl text-sm font-bold border transition-all ${i === 0 ? 'border-cyan-500 text-cyan-700 bg-cyan-50' : 'border-zinc-200 text-zinc-600 bg-white'}`}>
                              {color}
                              <input
                                type="number"
                                min="0"
                                value={formData.stock_by_color[color] ?? 0}
                                onChange={(e) => updateColorStock(color, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-14 text-center bg-white border border-zinc-200 rounded-lg py-1 text-xs font-black text-zinc-900 outline-none focus:border-cyan-500"
                                title={`${color} stok adedi`}
                              />
                              <FiX className="cursor-pointer opacity-50 hover:opacity-100 hover:text-red-500" onClick={() => removeColor(color)} />
                            </div>
                          ))}
                        </div>
                        {formData.colors.length > 0 && (
                          <p className="text-[11px] text-zinc-400 font-bold mb-3">Her rengin yanındaki kutuya o rengin stok adedini gir. Toplam stok bunların toplamı olarak otomatik hesaplanır.</p>
                        )}
                        <div className="flex gap-2">
                          <input className="flex-1 p-2 bg-white border border-zinc-200 rounded-lg outline-none text-sm" placeholder="Yeni renk yaz + Enter" value={newColor} onChange={e => setNewColor(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addColor(e)} />
                          <input type="submit" hidden onClick={addColor} />
                          <button onClick={addColor} className="bg-zinc-900 text-white px-4 text-sm font-bold rounded-lg hover:bg-cyan-600 transition-colors">Ekle</button>
                        </div>
                      </div>
                      <div className="flex gap-4 mb-8">
                        <div className="flex items-center justify-center border border-zinc-200 rounded-2xl px-4 w-20 bg-zinc-50"><span className="font-bold">1</span></div>
                        <button className={`flex-1 py-4 rounded-2xl font-bold transition-all ${isOutOfStock ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' : 'bg-zinc-900 text-white'}`}>{isOutOfStock ? 'Stokta Yok' : 'Sepete Ekle'}</button>
                        <button className="p-4 border border-zinc-200 rounded-2xl text-zinc-400 bg-zinc-50"><FiHeart size={20} /></button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div className="bg-zinc-50 rounded-2xl p-4 flex items-center gap-3 border border-zinc-100">
                            <FiTruck className="text-cyan-600" size={24} />
                            <div>
                               <p className="font-bold text-zinc-900 text-sm leading-none mb-1">Ücretsiz Kargo</p>
                               <p className="text-[10px] text-zinc-500">{storeSettings.shipping_text}</p>
                            </div>
                         </div>
                         <div className="bg-zinc-50 rounded-2xl p-4 flex items-center gap-3 border border-zinc-100">
                            <FiShield className="text-cyan-600" size={24} />
                            <div>
                               <p className="font-bold text-zinc-900 text-sm leading-none mb-1">Garanti</p>
                               <p className="text-[10px] text-zinc-500">{storeSettings.warranty_badge_text}</p>
                            </div>
                         </div>
                      </div>
                    </div>
                  </div>
                  <div className="border border-zinc-100 rounded-3xl p-4 sm:p-8 bg-zinc-50/50 mt-4">
                    <div className="flex gap-6 sm:gap-8 border-b border-zinc-200 pb-4 mb-6 overflow-x-auto no-scrollbar">
                      <button onClick={() => setActiveTab('long_description')} className={`font-black pb-4 -mb-[18px] transition-all shrink-0 whitespace-nowrap ${activeTab === 'long_description' ? 'text-zinc-900 border-b-2 border-cyan-600' : 'text-zinc-400 hover:text-zinc-600'}`}>Ürün Detayları</button>
                      <button onClick={() => setActiveTab('technical_specs')} className={`font-black pb-4 -mb-[18px] transition-all shrink-0 whitespace-nowrap ${activeTab === 'technical_specs' ? 'text-zinc-900 border-b-2 border-cyan-600' : 'text-zinc-400 hover:text-zinc-600'}`}>Teknik Özellikler</button>
                      <button onClick={() => setActiveTab('warranty_info')} className={`font-black pb-4 -mb-[18px] transition-all shrink-0 whitespace-nowrap ${activeTab === 'warranty_info' ? 'text-zinc-900 border-b-2 border-cyan-600' : 'text-zinc-400 hover:text-zinc-600'}`}>Garanti Bilgisi</button>
                    </div>
                    {activeTab === 'warranty_info' ? (
                      <div className="flex flex-col gap-4">
                        <input className={`w-full bg-transparent text-zinc-900 font-bold text-lg ${inlineInputClass}`} placeholder="Ürüne özel başlık" value={formData.warranty_info} onChange={(e) => setFormData({...formData, warranty_info: e.target.value})} />
                        <div className="p-4 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-600 mt-2 overflow-hidden">
                           <span className="text-[10px] font-black text-cyan-600 uppercase tracking-widest block mb-2">Ayarlardan Gelen Garanti Maddeleri</span>
                           <div
                             className="prose prose-zinc max-w-none prose-p:my-2 prose-li:my-1 prose-ul:my-2 break-words [overflow-wrap:anywhere]"
                             dangerouslySetInnerHTML={{ __html: temizHtml(storeSettings.warranty_tab_bullets || '') }}
                           />
                        </div>
                      </div>
                    ) : (
                      <textarea className={`appearance-none w-full h-48 bg-transparent text-zinc-600 text-sm leading-loose resize-none ${inlineInputClass}`} placeholder="Seçili sekme için uzun açıklama girin..." value={formData[activeTab]} onChange={(e) => setFormData({...formData, [activeTab]: e.target.value})} />
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* GÖRÜNTÜ AYARLARI MODALI (GALERİ + VİDEO YÖNETİMİ) */}
      {isMediaModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[65] animate-in fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden max-h-[85vh]">
            <div className="flex justify-between items-center p-6 border-b border-zinc-100 shrink-0">
              <div>
                <h2 className="text-2xl font-black text-zinc-900">Görüntü Ayarları</h2>
                <p className="text-sm text-zinc-500 mt-1">Ürün görselleri ve videosunu buradan yönetebilirsin.</p>
              </div>
              <button onClick={() => setIsMediaModalOpen(false)} className="p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 rounded-xl transition-all">
                <FiX size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* GÖRSEL GALERİSİ */}
              <div>
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wider mb-3">Görsel Galerisi ({formData.images.length}/{MAX_GALLERY_IMAGES})</h3>
                <div className="flex flex-wrap gap-3">
                  {formData.images.map((imgUrl, index) => (
                    <div
                      key={index}
                      className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-zinc-200 group shrink-0"
                    >
                      <img src={imgUrl} alt={`Görsel ${index + 1}`} className="w-full h-full object-cover" />
                      {index === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 bg-zinc-900/70 text-white text-[9px] font-black text-center py-0.5">KAPAK</span>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                        {index > 0 && (
                          <button
                            onClick={() => handleMoveImage(index, -1)}
                            className="w-7 h-7 bg-white text-zinc-700 rounded-full flex items-center justify-center hover:bg-cyan-600 hover:text-white transition-colors"
                            title="Sola/yukarı taşı"
                          >
                            <FiChevronLeft size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => handleReCropExisting(index)}
                          className="w-7 h-7 bg-white text-zinc-700 rounded-full flex items-center justify-center hover:bg-cyan-600 hover:text-white transition-colors"
                          title="Yeniden kırp"
                        >
                          <FiEdit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleRemoveImage(index)}
                          className="w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                          title="Görseli kaldır"
                        >
                          <FiX size={15} />
                        </button>
                        {index < formData.images.length - 1 && (
                          <button
                            onClick={() => handleMoveImage(index, 1)}
                            className="w-7 h-7 bg-white text-zinc-700 rounded-full flex items-center justify-center hover:bg-cyan-600 hover:text-white transition-colors"
                            title="Sağa/aşağı taşı"
                          >
                            <FiChevronRight size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {formData.images.length < MAX_GALLERY_IMAGES && (
                    <label className={`w-24 h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors shrink-0 ${isUploadingImage ? 'border-zinc-200 text-zinc-300 cursor-wait' : 'border-zinc-300 text-zinc-400 hover:border-cyan-500 hover:text-cyan-600'}`}>
                      {isUploadingImage ? <FiLoader className="animate-spin" size={20} /> : <FiPlus size={20} />}
                      <span className="text-[10px] font-bold">{isUploadingImage ? 'Yükleniyor' : 'Görsel Ekle'}</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden disabled={isUploadingImage} onChange={handleImageFileSelected} />
                    </label>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-2">Görselleri sürükleyerek sırasını değiştirebilirsin. İlk sıradaki otomatik olarak kapak görseli olur. Üzerine gelip kalem ikonuyla yeniden kırpabilirsin.</p>
              </div>

              {/* VİDEO */}
              <div>
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wider mb-1">Ürün Videosu</h3>
                <p className="text-xs text-zinc-400 mb-3">Video, müşteri tarafında galeri sıralamasının her zaman <strong>en sonunda</strong> gösterilir (görsellerden sonra).</p>
                {formData.video_url ? (
                  <div className="flex items-center gap-4 bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                    <video src={formData.video_url} className="w-32 h-20 object-cover rounded-lg bg-black shrink-0" controls muted />
                    <div className="flex flex-col gap-2">
                      <label className={`flex items-center gap-2 text-sm font-bold cursor-pointer ${isUploadingVideo ? 'text-zinc-300' : 'text-zinc-700 hover:text-cyan-600'}`}>
                        {isUploadingVideo ? <FiLoader className="animate-spin" size={16} /> : <FiVideo size={16} />}
                        {isUploadingVideo ? 'Yükleniyor...' : 'Videoyu Değiştir'}
                        <input type="file" accept="video/mp4,video/webm,video/quicktime" hidden disabled={isUploadingVideo} onChange={handleVideoUpload} />
                      </label>
                      <button
                        onClick={() => { deleteServerFile(formData.video_url); setFormData({ ...formData, video_url: '' }); }}
                        className="flex items-center gap-2 text-sm font-bold text-red-500 hover:text-red-700"
                      >
                        <FiX size={16} /> Videoyu Kaldır
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className={`flex items-center justify-center gap-2 w-full py-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${isUploadingVideo ? 'border-zinc-200 text-zinc-300 cursor-wait' : 'border-zinc-300 text-zinc-400 hover:border-cyan-500 hover:text-cyan-600'}`}>
                    {isUploadingVideo ? <FiLoader className="animate-spin" /> : <FiVideo />}
                    <span className="font-bold text-sm">{isUploadingVideo ? 'Yükleniyor...' : 'Video Yükle'}</span>
                    <input type="file" accept="video/mp4,video/webm,video/quicktime" hidden disabled={isUploadingVideo} onChange={handleVideoUpload} />
                  </label>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-zinc-100 bg-white flex justify-end">
              <button onClick={() => setIsMediaModalOpen(false)} className="bg-zinc-900 text-white px-8 py-2.5 rounded-xl font-black hover:bg-cyan-600 transition-all shadow-sm">
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GÖRSEL KIRPMA MODALI */}
      {cropModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-md flex flex-col shadow-2xl overflow-hidden max-h-[92vh]">
            <div className="flex justify-between items-center p-6 border-b border-zinc-100">
              <h2 className="text-xl font-black text-zinc-900">Görseli Kırp / Boyutlandır</h2>
              <button
                onClick={() => { setCropModalOpen(false); setCropImageSrc(null); setCropTargetIndex(null); }}
                className="p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 rounded-xl transition-all"
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="relative w-full h-[65vh] bg-white">
              {cropImageSrc && (
                <Cropper
                  image={cropImageSrc}
                  crop={crop}
                  zoom={zoom}
                  minZoom={0.4}
                  maxZoom={3}
                  restrictPosition={false}
                  aspect={4 / 5}
                  cropShape="rect"
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              )}
            </div>

            <div className="p-6 flex items-center gap-4">
              <FiZoomIn className="text-zinc-400 shrink-0" />
              <input
                type="range"
                min={0.4}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-cyan-600"
              />
            </div>

            <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-3">
              <button
                onClick={() => { setCropModalOpen(false); setCropImageSrc(null); setCropTargetIndex(null); }}
                className="px-6 py-2.5 font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleConfirmCrop}
                disabled={isUploadingImage}
                className={`flex items-center gap-2 bg-zinc-900 text-white px-8 py-2.5 rounded-xl font-black transition-all shadow-sm ${isUploadingImage ? 'opacity-50 cursor-wait' : 'hover:bg-cyan-600'}`}
              >
                {isUploadingImage ? <FiLoader className="animate-spin" /> : <FiSave />}
                {isUploadingImage ? 'Yükleniyor...' : 'Kırp ve Ekle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;