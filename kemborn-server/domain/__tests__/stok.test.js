import { describe, it, expect } from 'vitest';
import { stokAyrilmisMi } from '../stok.js';

describe('stokAyrilmisMi', () => {
  it('ödeme bekleyen ve ödenmiş siparişlerde stoğu ayrılmış sayar', () => {
    expect(stokAyrilmisMi('ÖDEME BEKLENİYOR')).toBe(true);
    expect(stokAyrilmisMi('ÖDENDİ')).toBe(true);
    expect(stokAyrilmisMi('KARGODA')).toBe(true);
  });

  it('TUTAR UYUŞMAZLIĞI durumunda da stoğu ayrılmış sayar (incelenene kadar satılmasın)', () => {
    expect(stokAyrilmisMi('TUTAR UYUŞMAZLIĞI')).toBe(true);
  });

  it('iptal edilmiş ve ödeme başarısız siparişlerde stoğu SERBEST sayar', () => {
    expect(stokAyrilmisMi('İPTAL EDİLDİ')).toBe(false);
    expect(stokAyrilmisMi('ÖDEME BAŞARISIZ')).toBe(false);
  });

  it('küçük harfle veya karaktersiz yazılmış durumu da tanır', () => {
    expect(stokAyrilmisMi('odendi')).toBe(true);
    expect(stokAyrilmisMi('ODENDI')).toBe(true);
  });

  it('tanınmayan veya boş durumu ayrılmamış sayar', () => {
    expect(stokAyrilmisMi('BİLİNMEYEN DURUM')).toBe(false);
    expect(stokAyrilmisMi('')).toBe(false);
    expect(stokAyrilmisMi(null)).toBe(false);
  });
});
