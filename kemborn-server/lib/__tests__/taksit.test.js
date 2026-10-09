import { describe, it, expect } from 'vitest';
import { taksitliTutar, taksitSecenekleri } from '../taksit.js';

const tablo = {
  maxTaksit: 12,
  oranlar: { bonus: { 2: 7.63, 3: 9.67, 12: 28 }, axess: { 2: 7.63, 3: 9.67, 6: 15.78 } }
};
const kredi = (program, ek = {}) => ({ kredi: true, ticari: false, program, banka: 'Garanti', ...ek });

describe('taksitliTutar', () => {
  it('PayTR formülünü uygular: tutar / (1 - oran)', () => {
    expect(taksitliTutar(2999, 28)).toBe(4165.28);
    expect(taksitliTutar(2999, 9.67)).toBe(3320.05);
  });

  it('kuruşa YUKARI yuvarlar, eksik tahsilat olmaz', () => {
    const t = taksitliTutar(2999, 9.67);
    expect(t * (1 - 0.0967)).toBeGreaterThanOrEqual(2999);
  });

  it('tam bölünen tutarı fazladan bir kuruş artırmaz', () => {
    expect(taksitliTutar(72, 28)).toBe(100);
  });

  it('oran yoksa tutar aynen kalır', () => {
    expect(taksitliTutar(2999.99, 0)).toBe(2999.99);
  });
});

describe('taksitSecenekleri', () => {
  it('programlı kredi kartına oranlı taksitleri sunar', () => {
    const { secenekler, neden } = taksitSecenekleri(1000, kredi('bonus'), tablo);
    expect(neden).toBeNull();
    expect(secenekler.map(s => s.taksit)).toEqual([0, 2, 3, 12]);
    expect(secenekler[0].toplam).toBe(1000);
  });

  it('banka kartına sadece tek çekim', () => {
    const r = taksitSecenekleri(1000, kredi('bonus', { kredi: false }), tablo);
    expect(r.secenekler.map(s => s.taksit)).toEqual([0]);
    expect(r.neden).toMatch(/Banka kart/);
  });

  it('ticari ve programsız kartlara sadece tek çekim', () => {
    expect(taksitSecenekleri(1000, kredi('bonus', { ticari: true }), tablo).secenekler).toHaveLength(1);
    expect(taksitSecenekleri(1000, kredi(null), tablo).secenekler).toHaveLength(1);
  });

  it('Odeabank Axess (Bank\'O Card) en fazla 3 taksit', () => {
    const r = taksitSecenekleri(1000, kredi('axess', { banka: 'Odeabank' }), tablo);
    expect(r.secenekler.map(s => s.taksit)).toEqual([0, 2, 3]);
  });

  it('oranlar alınamazsa tek çekime düşer', () => {
    const r = taksitSecenekleri(1000, kredi('bonus'), null);
    expect(r.secenekler).toHaveLength(1);
    expect(r.neden).toBeTruthy();
  });

  it('PayTR üst sınırını (max_inst_non_bus) uygular', () => {
    const r = taksitSecenekleri(1000, kredi('bonus'), { ...tablo, maxTaksit: 3 });
    expect(r.secenekler.map(s => s.taksit)).toEqual([0, 2, 3]);
  });
});
