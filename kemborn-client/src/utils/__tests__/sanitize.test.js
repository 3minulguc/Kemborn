import { describe, it, expect } from 'vitest';
import { temizHtml } from '../sanitize.js';

describe('temizHtml — güvenlik', () => {
  it('script etiketini tamamen atar', () => {
    expect(temizHtml('<p>merhaba</p><script>alert(1)</script>')).not.toContain('script');
  });

  it('onerror gibi olay dinleyicilerini atar', () => {
    const sonuc = temizHtml('<img src=x onerror="alert(1)">');
    expect(sonuc).not.toContain('onerror');
  });

  it('izin verilen biçimlendirme etiketlerini korur', () => {
    const sonuc = temizHtml('<h2>Başlık</h2><p><strong>kalın</strong> yazı</p>');
    expect(sonuc).toContain('<h2>Başlık</h2>');
    expect(sonuc).toContain('<strong>kalın</strong>');
  });

  it('target="_blank" linkine rel="noopener noreferrer" ekler', () => {
    const sonuc = temizHtml('<a href="https://x.com" target="_blank">link</a>');
    expect(sonuc).toContain('rel="noopener noreferrer"');
  });
});

describe('temizHtml — Quill yapıştırma hasarı temizliği', () => {
  it('içi tamamen boş paragraf/madde işaretlerini kaldırır', () => {
    const sonuc = temizHtml('<p>Dolu satır</p><p></p><li></li>');
    expect(sonuc).not.toContain('<li></li>');
    expect(sonuc).toContain('Dolu satır');
  });

  it('kasıtlı boş satırı (br içeren p) SİLMEZ', () => {
    const sonuc = temizHtml('<p>Üst</p><p><br></p><p>Alt</p>');
    expect(sonuc).toContain('<br>');
  });

  it('&nbsp; karakterini normal boşluğa çevirir (satır kırmayı engelliyordu)', () => {
    const sonuc = temizHtml('<p>uzun&nbsp;bir&nbsp;cümle</p>');
    expect(sonuc).not.toContain(' ');
    expect(sonuc).toContain('uzun bir cümle');
  });

  it('içi tamamen boşalan liste kabını da kaldırır', () => {
    const sonuc = temizHtml('<p>metin</p><ul><li></li><li></li></ul>');
    expect(sonuc).not.toContain('<ul>');
  });

  it('boş veya tanımsız girdide çökmeden boş döner', () => {
    expect(temizHtml('')).toBe('');
    expect(temizHtml(null)).toBe('');
  });
});
