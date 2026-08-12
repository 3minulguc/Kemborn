import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Bu testler, sekme seçimini ve sayfa sıfırlamayı useEffect'ten render
// sırasına taşıyan değişikliği koruyor. O değişiklikten önce React önce
// YANLIŞ değerle bir kere çizip sonra düzeltiyordu; yani doğru sonuç
// yine de geliyordu ama arada bir kare yanlış görüntü vardı. Testler bu
// yüzden "ilk çizimde doğru mu" sorusuna bakıyor.

const toastSahte = { success: vi.fn(), error: vi.fn() };
vi.mock('react-hot-toast', () => ({ default: toastSahte }));

const apiFetchSahte = vi.fn();
vi.mock('../../../utils/apiFetch', () => ({ apiFetch: (...a) => apiFetchSahte(...a) }));

const { default: AdminOrders } = await import('../AdminOrders.jsx');

// PAGE_SIZE 15. Dağılım bilerek dengesiz: KARGODA'ya 20 sipariş düşüyor ki
// o sekme de TEK SAYFAYA SIĞMASIN — sekme değişince sayfanın 1'e döndüğünü
// ancak birden fazla sayfası olan bir sekmede sınayabiliriz. Hepsi 10'ar
// olsaydı sekmeye geçince sayfalama tamamen kaybolur, test hiçbir şey
// kanıtlamazdı.
//   0-19  → KARGODA      (20 adet, 2 sayfa)
//   20-29 → HAZIRLANIYOR (10 adet)
//   30-39 → ÖDENDİ       (10 adet)
const TOPLAM = 40;
const durumu = (i) => (i < 20 ? 'KARGODA' : i < 30 ? 'HAZIRLANIYOR' : 'ÖDENDİ');

const siparisUret = () =>
  Array.from({ length: TOPLAM }, (_, i) => ({
    id: i + 1,
    order_number: `SIP-${1000 + i}`,
    customer_name: i % 2 === 0 ? `Ahmet ${i}` : `Zeynep ${i}`,
    created_at: '2026-08-01T10:00:00.000Z',
    total_amount: 2650,
    status: durumu(i)
  }));

const ciz = (baslangicYolu = '/admin/orders') =>
  render(
    <MemoryRouter initialEntries={[baslangicYolu]}>
      <AdminOrders />
    </MemoryRouter>
  );

beforeEach(() => {
  apiFetchSahte.mockReset();
  apiFetchSahte.mockResolvedValue({ ok: true, json: async () => siparisUret() });
});

afterEach(cleanup);

const aktifSekme = () =>
  screen.getAllByRole('button', { pressed: true }).map(b => b.textContent.replace(/\s*\(\d+\)\s*$/, '').trim())[0];

// Aynı sipariş hem masaüstü tablosunda hem mobil kartında yazılıyor; CSS ile
// biri gizleniyor ama jsdom stil uygulamadığı için ikisini de görüyor.
// Sayım yapan sorgular bu yüzden sadece tabloya bakıyor.
const tablodakiSiparisNolar = () =>
  within(document.querySelector('table')).getAllByText(/^SIP-\d+$/).map(e => e.textContent);

describe('AdminOrders — URL\'deki status parametresi', () => {
  it('?status=KARGODA ile girilince Kargoda sekmesi seçili gelir', async () => {
    ciz('/admin/orders?status=KARGODA');
    await waitFor(() => expect(aktifSekme()).toBe('Kargoda'));
  });

  it('parametre yokken Tümü sekmesi seçili gelir', async () => {
    ciz('/admin/orders');
    await waitFor(() => expect(aktifSekme()).toBe('Tümü'));
  });

  it('küçük harfle ve boşluklu gelen parametreyi de tanır', async () => {
    ciz('/admin/orders?status=%20hazirlaniyor%20');
    await waitFor(() => expect(aktifSekme()).toBe('Hazırlanıyor'));
  });

  it('seçili sekmenin dışındaki siparişleri listelemez', async () => {
    ciz('/admin/orders?status=HAZIRLANIYOR');
    // HAZIRLANIYOR olan 10 sipariş: SIP-1020 .. SIP-1029, tek sayfaya sığar.
    await waitFor(() => expect(tablodakiSiparisNolar().length).toBe(10));
    expect(tablodakiSiparisNolar()).toContain('SIP-1020');
    expect(tablodakiSiparisNolar()).not.toContain('SIP-1000'); // KARGODA
    expect(tablodakiSiparisNolar()).not.toContain('SIP-1030'); // ÖDENDİ
  });
});

describe('AdminOrders — arama ve sekme değişince sayfa sıfırlama', () => {
  it('2. sayfadayken arama yazılınca 1. sayfaya döner', async () => {
    const kullanici = userEvent.setup();
    ciz('/admin/orders');

    await waitFor(() => expect(screen.getByText(/Sayfa 1 \/ 3/)).toBeDefined());

    await kullanici.click(screen.getByRole('button', { name: 'Sonraki' }));
    expect(screen.getByText(/Sayfa 2 \/ 3/)).toBeDefined();

    // Aramaya tek harf yazmak bile sayfayı 1'e çekmeli; yoksa admin
    // 2. sayfada kalıp "sonuç yok" sanır.
    await kullanici.type(screen.getByPlaceholderText(/Sipariş no veya müşteri adı/), 'Zeynep');

    await waitFor(() => expect(screen.getByText(/Sayfa 1 \//)).toBeDefined());
  });

  it('2. sayfadayken sekme değiştirilince 1. sayfaya döner', async () => {
    const kullanici = userEvent.setup();
    ciz('/admin/orders');

    await waitFor(() => expect(screen.getByText(/Sayfa 1 \/ 3/)).toBeDefined());
    await kullanici.click(screen.getByRole('button', { name: 'Sonraki' }));
    expect(screen.getByText(/Sayfa 2 \/ 3/)).toBeDefined();

    // Kargoda'nın 2 sayfası var; sayfalama kaybolmadığı için "1'e döndü mü"
    // sorusu burada gerçekten sınanabiliyor.
    await kullanici.click(screen.getByRole('button', { name: /^Kargoda/ }));

    await waitFor(() => expect(aktifSekme()).toBe('Kargoda'));
    expect(screen.getByText(/Sayfa 1 \/ 2/)).toBeDefined();
    // Sayfa 2'de kalsaydı listenin başındaki kayıt görünmezdi.
    expect(tablodakiSiparisNolar()).toContain('SIP-1000');
  });
});

describe('AdminOrders — veri çekme', () => {
  it('açılışta siparişleri bir kere çeker', async () => {
    ciz('/admin/orders');
    await waitFor(() => expect(tablodakiSiparisNolar()).toContain('SIP-1000'));
    expect(apiFetchSahte).toHaveBeenCalledTimes(1);
    expect(apiFetchSahte).toHaveBeenCalledWith('/api/admin/orders');
  });

  it('sunucu hata dönerse çökmez, boş liste gösterir', async () => {
    apiFetchSahte.mockResolvedValue({ ok: false, json: async () => ({}) });
    ciz('/admin/orders');
    await waitFor(() =>
      expect(screen.getAllByText(/herhangi bir sipariş kaydı bulunamadı/).length).toBeGreaterThan(0)
    );
  });
});
