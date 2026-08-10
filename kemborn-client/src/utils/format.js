// Tüm sitede fiyatları TUTARLI göstermek için tek merkezi fonksiyon.
// "740" -> "740,00"  |  "740.5" -> "740,50"  |  740 -> "740,00"
// Bu sayede kuruş kısmı "00" olsa bile asla kaybolmaz.
export const formatPrice = (price) => {
  const num = typeof price === 'number' ? price : parseFloat(String(price ?? '').replace(',', '.')) || 0;
  return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Telefon numarasını okunur hale getirir.
// "08502441386" -> "0850 244 13 86"   |   "+905551112233" -> "+90 555 111 22 33"
// Tanımadığı bir biçim gelirse OLDUĞU GİBİ döner: yanlış gruplayıp
// numarayı okunmaz hale getirmektense dokunmamak daha iyi.
export const formatPhone = (phone) => {
  const ham = String(phone ?? '').trim();
  if (!ham) return '';
  const rakam = ham.replace(/\D/g, '');

  if (ham.startsWith('+90') && rakam.length === 12) {
    const n = rakam.slice(2);
    return `+90 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 8)} ${n.slice(8)}`;
  }
  if (rakam.length === 11 && rakam.startsWith('0')) {
    return `${rakam.slice(0, 4)} ${rakam.slice(4, 7)} ${rakam.slice(7, 9)} ${rakam.slice(9)}`;
  }
  if (rakam.length === 10) {
    return `0${rakam.slice(0, 3)} ${rakam.slice(3, 6)} ${rakam.slice(6, 8)} ${rakam.slice(8)}`;
  }
  return ham;
};

// Admin panelinden gelen metinlerde virgülden sonra boşluk unutulabiliyor
// ("Aydın,Türkiye"). Veriyi değiştirmeden gösterimde düzeltiyoruz.
export const formatAdres = (adres) =>
  String(adres ?? '').replace(/\s*,\s*/g, ', ').trim();
