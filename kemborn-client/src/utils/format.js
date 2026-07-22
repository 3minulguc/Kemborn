// Tüm sitede fiyatları TUTARLI göstermek için tek merkezi fonksiyon.
// "740" -> "740,00"  |  "740.5" -> "740,50"  |  740 -> "740,00"
// Bu sayede kuruş kısmı "00" olsa bile asla kaybolmaz.
export const formatPrice = (price) => {
  const num = typeof price === 'number' ? price : parseFloat(String(price ?? '').replace(',', '.')) || 0;
  return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
