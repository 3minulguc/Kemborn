import { describe, it, expect } from 'vitest';
import { round2 } from '../para.js';

describe('round2', () => {
  it('kayan nokta hatasını telafi eder', () => {
    // Ham JS'te 1.005 * 100 = 100.49999999999999 -> Math.round 1.00 verir.
    // Bu satır, o hatanın bir daha geri gelmediğini kanıtlıyor.
    expect(round2(1.005)).toBe(1.01);
  });

  it('normal kuruş değerlerini olduğu gibi bırakır', () => {
    expect(round2(299.99)).toBe(299.99);
    expect(round2(100)).toBe(100);
  });

  it('ikiden fazla ondalık hanesini kuruşa yuvarlar', () => {
    expect(round2(19.996)).toBe(20);
    expect(round2(19.994)).toBe(19.99);
  });

  it('negatif ve sıfır değerlerde de doğru çalışır', () => {
    expect(round2(0)).toBe(0);
    expect(round2(-5.005)).toBe(-5);
  });
});
