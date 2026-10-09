// Taksit tutarı — SADECE GÖSTERİM İÇİN.
// Sunucudaki lib/taksit.js ile aynı formül (PayTR: tutar / (1 - oran)),
// kuruşa yukarı yuvarlanmış. Tahsil edilen tutarı her zaman sunucu hesaplar;
// bu ikisi ayrışırsa müşteri ürün sayfasında başka, ödemede başka rakam görür.
export const taksitliTutar = (tutar, oran) => {
  if (!oran) return Math.round(tutar * 100) / 100;
  return Math.ceil((tutar * 100) / (1 - oran / 100) - 1e-9) / 100;
};

export const aylikTutar = (toplam, taksit) => Math.ceil((toplam * 100) / taksit) / 100;

// PayTR'nin program kodları -> ekranda görünen ad
export const PROGRAM_ADLARI = {
  advantage: 'Advantage',
  axess: 'Axess',
  bonus: 'Bonus',
  cardfinans: 'CardFinans',
  combo: 'Bankkart Combo',
  maximum: 'Maximum',
  paraf: 'Paraf',
  saglamkart: 'Sağlam Kart',
  world: 'World'
};

// Aynı oranlara sahip kart programlarını tek tabloda topluyor. Şu an PayTR'de
// tüm programların oranı aynı, yani tek tablo çıkıyor; oranlar ayrışırsa her
// grup için ayrı tablo gösteriliyor.
export const programGruplari = (oranlar, maxTaksit) => {
  const gruplar = new Map();
  for (const [program, tablo] of Object.entries(oranlar)) {
    const satirlar = Object.entries(tablo)
      .map(([sayi, oran]) => [Number(sayi), oran])
      .filter(([sayi]) => sayi >= 2 && sayi <= maxTaksit)
      .sort((a, b) => a[0] - b[0]);
    if (satirlar.length === 0) continue;
    const anahtar = JSON.stringify(satirlar);
    if (!gruplar.has(anahtar)) gruplar.set(anahtar, { programlar: [], satirlar });
    gruplar.get(anahtar).programlar.push(PROGRAM_ADLARI[program] || program);
  }
  return [...gruplar.values()];
};

// Ürün sayfası özeti için: en uzun vadedeki aylık tutar.
export const enDusukAylik = (fiyat, veri) => {
  if (!veri?.maxTaksit) return null;
  let sonuc = null;
  for (const { satirlar } of programGruplari(veri.oranlar, veri.maxTaksit)) {
    const [sayi, oran] = satirlar[satirlar.length - 1];
    const aylik = aylikTutar(taksitliTutar(fiyat, oran), sayi);
    if (!sonuc || aylik < sonuc.aylik) sonuc = { taksit: sayi, aylik };
  }
  return sonuc;
};
