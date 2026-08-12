import { describe, it, expect } from 'vitest';
import { aramaIcinNormalize, sqlKatlamaParametreleri } from '../arama.js';

describe('aramaIcinNormalize', () => {
  it('Türkçe büyük İ harfini ASCII i harfine katlar', () => {
    // JS'in toLowerCase()'i "İ"yi "i" + birleşik nokta (U+0307) yapar, bu
    // yüzden müşteri "interkom" yazınca "İnterkom Seti" hiç bulunamıyordu.
    expect(aramaIcinNormalize('X2 Pro İnterkom Seti')).toBe('x2 pro interkom seti');
  });

  it('diğer Türkçe harfleri de katlar', () => {
    expect(aramaIcinNormalize('ŞARJ ÜNİTESİ ÇİFT')).toBe('sarj unitesi cift');
  });

  it('zaten ASCII olan terimi değiştirmeden küçültür', () => {
    expect(aramaIcinNormalize('interkom')).toBe('interkom');
  });

  it('boş veya tanımsız girdide çökmez', () => {
    expect(aramaIcinNormalize('')).toBe('');
    expect(aramaIcinNormalize(undefined)).toBe('');
  });
});

describe('sqlKatlamaParametreleri', () => {
  it('FROM ve TO dizileri aynı uzunlukta olmalı (translate() şartı)', () => {
    const [from, to] = sqlKatlamaParametreleri();
    expect(from.length).toBe(to.length);
    expect(from.length).toBeGreaterThan(0);
  });
});
