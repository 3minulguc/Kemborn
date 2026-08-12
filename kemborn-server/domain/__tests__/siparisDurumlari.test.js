import { describe, it, expect } from 'vitest';
import { SIPARIS_DURUMLARI, sqlDurumListesi, CIRO_DURUMLARI, GERCEK_SIPARIS_DURUMLARI } from '../siparisDurumlari.js';

describe('sqlDurumListesi', () => {
  it('tek tırnağı SQL-güvenli şekilde kaçırır', () => {
    expect(sqlDurumListesi(["O'Brien"])).toBe("'O''Brien'");
  });

  it('birden fazla grubu tek listede birleştirir', () => {
    expect(sqlDurumListesi(['A', 'B'], ['C'])).toBe("'A', 'B', 'C'");
  });
});

describe('CIRO_DURUMLARI', () => {
  it('ödenmemiş ve iptal durumlarını İÇERMEZ', () => {
    for (const durum of SIPARIS_DURUMLARI.ODEME_BEKLENIYOR) {
      expect(CIRO_DURUMLARI).not.toContain(durum);
    }
    for (const durum of SIPARIS_DURUMLARI.IPTAL_EDILDI) {
      expect(CIRO_DURUMLARI).not.toContain(durum);
    }
    for (const durum of SIPARIS_DURUMLARI.ODEME_BASARISIZ) {
      expect(CIRO_DURUMLARI).not.toContain(durum);
    }
  });

  it('gerçekten ödenmiş durumları içerir', () => {
    for (const durum of SIPARIS_DURUMLARI.ODENDI) {
      expect(CIRO_DURUMLARI).toContain(durum);
    }
  });
});

describe('GERCEK_SIPARIS_DURUMLARI', () => {
  it('iptali sayar ama hiç ödenmemişi saymaz', () => {
    expect(GERCEK_SIPARIS_DURUMLARI).toContain(SIPARIS_DURUMLARI.IPTAL_EDILDI[0]);
    expect(GERCEK_SIPARIS_DURUMLARI).not.toContain(SIPARIS_DURUMLARI.ODEME_BEKLENIYOR[0]);
  });
});
