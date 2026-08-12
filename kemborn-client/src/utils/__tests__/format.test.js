import { describe, it, expect } from 'vitest';
import { formatPrice, formatPhone, formatAdres } from '../format.js';

describe('formatPrice', () => {
  it('kuruş kısmı "00" olsa bile göstermeye devam eder', () => {
    expect(formatPrice(740)).toBe('740,00');
    expect(formatPrice('740')).toBe('740,00');
  });

  it('ondalıklı değeri Türkçe biçime çevirir', () => {
    expect(formatPrice(740.5)).toBe('740,50');
    expect(formatPrice('740.5')).toBe('740,50');
  });

  it('geçersiz girdide çökmeden 0,00 döner', () => {
    expect(formatPrice(undefined)).toBe('0,00');
    expect(formatPrice('bozuk')).toBe('0,00');
  });
});

describe('formatPhone', () => {
  it('0 ile başlayan 11 haneli numarayı gruplar', () => {
    expect(formatPhone('08502441386')).toBe('0850 244 13 86');
  });

  it('+90 ile başlayan numarayı gruplar', () => {
    expect(formatPhone('+905551112233')).toBe('+90 555 111 22 33');
  });

  it('başında 0 olmayan 10 haneli numaraya 0 ekleyip gruplar', () => {
    expect(formatPhone('5551112233')).toBe('0555 111 22 33');
  });

  it('tanımadığı bir biçimi OLDUĞU GİBİ döner (yanlış gruplamaz)', () => {
    expect(formatPhone('123')).toBe('123');
  });

  it('boş girdide boş döner', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone(undefined)).toBe('');
  });
});

describe('formatAdres', () => {
  it('virgülden sonra boşluk unutulmuşsa ekler', () => {
    expect(formatAdres('Aydın,Türkiye')).toBe('Aydın, Türkiye');
  });

  it('zaten doğru biçimlenmiş adrese dokunmaz', () => {
    expect(formatAdres('Aydın, Türkiye')).toBe('Aydın, Türkiye');
  });

  it('virgül etrafındaki fazla boşluğu tek boşluğa indirir', () => {
    expect(formatAdres('Aydın   ,   Türkiye')).toBe('Aydın, Türkiye');
  });
});
