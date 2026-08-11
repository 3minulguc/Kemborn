import mesafeliSatis from './mesafeli-satis.html?raw';
import kvkkGizlilik from './kvkk-gizlilik.html?raw';
import teslimatIade from './teslimat-iade.html?raw';

// ==========================================
// YASAL METİNLERİN DEPODAKİ ASLI
// ==========================================
// Bu üç metin hem sitede yedek olarak kullanılıyor hem de admin panelinde
// "Depodaki metni geri yükle" butonunun kaynağı.
//
// Ayarlarda bir metin kayıtlıysa sitede O gösterilir — düzenleme yetkisi
// adminde. Ayarlardaki alan boşsa buradaki asıl metin devreye giriyor, yani
// yasal sayfalar hiçbir koşulda boş kalmıyor.
//
// Anahtarlar bilerek veritabanı sütun adlarıyla birebir aynı.
export const YASAL_VARSAYILAN = {
  distance_selling_policy: mesafeliSatis,
  privacy_policy: kvkkGizlilik,
  delivery_return_policy: teslimatIade
};

export const YASAL_BASLIK = {
  distance_selling_policy: 'Mesafeli Satış Sözleşmesi',
  privacy_policy: 'Gizlilik ve KVKK Aydınlatma Metni',
  delivery_return_policy: 'Teslimat ve İade'
};
