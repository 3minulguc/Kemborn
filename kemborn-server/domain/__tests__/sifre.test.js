import { describe, it, expect } from 'vitest';
import { sifreKuraliniDenetle } from '../sifre.js';

describe('sifreKuraliniDenetle', () => {
  it('8 karakterden kısa şifreyi reddeder', () => {
    expect(sifreKuraliniDenetle('abc123')).toMatch(/en az 8 karakter/);
  });

  it('sadece rakam içeren şifreyi reddeder', () => {
    expect(sifreKuraliniDenetle('12345678')).toBeTruthy();
  });

  it('sadece harf içeren şifreyi reddeder', () => {
    expect(sifreKuraliniDenetle('abcdefgh')).toMatch(/en az bir rakam/);
  });

  it('yaygın şifreleri (büyük/küçük harf fark etmeksizin) reddeder', () => {
    expect(sifreKuraliniDenetle('Kemborn123')).toMatch(/çok yaygın/);
  });

  it('kurala uyan şifreyi kabul eder (null döner)', () => {
    expect(sifreKuraliniDenetle('guclu1sifre')).toBeNull();
  });

  it('Türkçe karakterli şifreyi harf olarak sayar', () => {
    expect(sifreKuraliniDenetle('şifrem12')).toBeNull();
  });

  it('boş veya tanımsız şifreyi reddeder', () => {
    expect(sifreKuraliniDenetle('')).toBeTruthy();
    expect(sifreKuraliniDenetle(undefined)).toBeTruthy();
  });
});
