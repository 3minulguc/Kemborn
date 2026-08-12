import { describe, it, expect } from 'vitest';
import { aramaIcinNormalize, urunAramayaUyuyorMu } from '../search.js';

describe('aramaIcinNormalize', () => {
  it('Türkçe büyük İ harfini ASCII i harfine katlar (JS toLowerCase() hatası)', () => {
    // "İ".toLowerCase() JS'te "i" + birleşik nokta (U+0307) üretir; bu yüzden
    // müşteri "interkom" yazınca mağazanın ana ürünü hiç bulunamıyordu.
    expect(aramaIcinNormalize('X2 Pro İnterkom Seti')).toBe('x2 pro interkom seti');
  });

  it('şarj/güç/çift gibi diğer Türkçe harfleri de katlar', () => {
    expect(aramaIcinNormalize('ŞARJ GÜCÜ ÇİFT')).toBe('sarj gucu cift');
  });
});

describe('urunAramayaUyuyorMu', () => {
  const urun = { name: 'Kemborn X2 Pro İnterkom Seti', short_description: 'Çift kişilik şarj kutulu set' };

  it('Türkçe klavyesiz yazılan terimle eşleşir', () => {
    expect(urunAramayaUyuyorMu(urun, 'interkom')).toBe(true);
    expect(urunAramayaUyuyorMu(urun, 'sarj')).toBe(true);
  });

  it('kısa açıklamada da arar, sadece isimde değil', () => {
    expect(urunAramayaUyuyorMu(urun, 'kutulu')).toBe(true);
  });

  it('eşleşmeyen terimde false döner', () => {
    expect(urunAramayaUyuyorMu(urun, 'kulaklik-yok-boyle-bir-sey')).toBe(false);
  });

  it('boş terimde her ürünü eşleşmiş sayar', () => {
    expect(urunAramayaUyuyorMu(urun, '')).toBe(true);
  });
});
