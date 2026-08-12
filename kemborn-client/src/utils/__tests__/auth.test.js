import { describe, it, expect, beforeEach } from 'vitest';
import { getToken, getStoredUser, isTokenValid, saveSession, clearSession } from '../auth.js';

// Gerçek imzayı doğrulamıyoruz (o sunucunun işi) — sadece payload'daki "exp"
// alanına bakan sahte bir JWT üretiyoruz.
const sahteToken = (expSaniyeSonra) => {
  const b64 = (obj) => btoa(JSON.stringify(obj));
  const payload = { id: 1, exp: Math.floor(Date.now() / 1000) + expSaniyeSonra };
  return `${b64({ alg: 'none' })}.${b64(payload)}.imza`;
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('saveSession / getToken / getStoredUser', () => {
  it('"beni hatırla" işaretliyse localStorage\'a yazar', () => {
    saveSession({ id: 1, username: 'test' }, 'tok-123', true);
    expect(localStorage.getItem('kemborn_token')).toBe('tok-123');
    expect(sessionStorage.getItem('kemborn_token')).toBeNull();
    expect(getToken()).toBe('tok-123');
    expect(getStoredUser()).toEqual({ id: 1, username: 'test' });
  });

  it('"beni hatırla" işaretli değilse sessionStorage\'a yazar', () => {
    saveSession({ id: 1, username: 'test' }, 'tok-456', false);
    expect(sessionStorage.getItem('kemborn_token')).toBe('tok-456');
    expect(localStorage.getItem('kemborn_token')).toBeNull();
    expect(getToken()).toBe('tok-456');
  });

  it('yeni oturum açılınca ESKİ depodaki kaydı temizler', () => {
    // Önce kalıcı (localStorage) oturum aç, sonra "beni hatırla" işaretlemeden
    // tekrar gir — eski kalıcı kayıt arkada kalmamalı.
    saveSession({ id: 1 }, 'eski-token', true);
    saveSession({ id: 1 }, 'yeni-token', false);
    expect(localStorage.getItem('kemborn_token')).toBeNull();
    expect(getToken()).toBe('yeni-token');
  });
});

describe('clearSession', () => {
  it('her iki depodaki oturumu da temizler', () => {
    saveSession({ id: 1 }, 'tok', true);
    clearSession();
    expect(getToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });
});

describe('isTokenValid', () => {
  it('süresi dolmamış token için true döner', () => {
    expect(isTokenValid(sahteToken(3600))).toBe(true);
  });

  it('süresi dolmuş token için false döner', () => {
    expect(isTokenValid(sahteToken(-3600))).toBe(false);
  });

  it('bozuk/tanımsız token için false döner', () => {
    expect(isTokenValid('bozuk-token')).toBe(false);
    expect(isTokenValid(null)).toBe(false);
    expect(isTokenValid('')).toBe(false);
  });
});
