import { describe, it, expect, vi, beforeEach } from 'vitest';

// DNS'i taklit ediyoruz: gerçek ağ sorgusu CI'da yavaş/kararsız olur ve testin
// sonucu internet bağlantısına bağımlı hale gelirdi. Burada sadece
// epostaGercekMi'nin MX/A kaydı sonucuna göre DOĞRU KARAR VERDİĞİNİ test
// ediyoruz, gerçek DNS altyapısını değil.
vi.mock('dns', () => ({
  promises: {
    resolveMx: vi.fn(),
    resolve: vi.fn()
  }
}));

import { promises as dnsPromises } from 'dns';
import { epostaGercekMi } from '../eposta.js';

describe('epostaGercekMi', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('biçimi bozuk e-postayı DNS\'e hiç sormadan reddeder', async () => {
    expect(await epostaGercekMi('bozuk-format')).toBe(false);
    expect(dnsPromises.resolveMx).not.toHaveBeenCalled();
  });

  it('MX kaydı olan domaini kabul eder', async () => {
    dnsPromises.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]);
    expect(await epostaGercekMi('test@example.com')).toBe(true);
  });

  it('MX kaydı yoksa ama A kaydı varsa yine kabul eder (RFC 5321 düşüşü)', async () => {
    dnsPromises.resolveMx.mockRejectedValue(new Error('MX yok'));
    dnsPromises.resolve.mockResolvedValue(['1.2.3.4']);
    expect(await epostaGercekMi('test@example.com')).toBe(true);
  });

  it('ne MX ne A kaydı varsa reddeder', async () => {
    dnsPromises.resolveMx.mockRejectedValue(new Error('MX yok'));
    dnsPromises.resolve.mockRejectedValue(new Error('NXDOMAIN'));
    expect(await epostaGercekMi('asdf@asdfqwertyzxcv123456.com')).toBe(false);
  });
});
