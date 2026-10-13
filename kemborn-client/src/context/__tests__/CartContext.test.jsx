import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// addToCart(ürün, adet, renk) imzasını koruyor. Ürün sayfası ilk yüklemeden
// beri adedi ve rengi ürün nesnesinin İÇİNE koyup gönderiyordu; varsayılanlar
// (1 adet, Siyah) üstüne yazıldığı için 3 adet kırmızı seçen müşterinin
// sepetine 1 adet siyah düşüyordu.

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../utils/analitik', () => ({ olayGonder: vi.fn(), urunuBicimle: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));

const { CartProvider } = await import('../CartContext.jsx');
const { useCart } = await import('../../hooks/useCart.js');

const urun = { id: 7, name: 'X2 Pro', price: '2650.00' };
const sepetiAc = () => renderHook(() => useCart(), { wrapper: CartProvider });

describe('addToCart', () => {
  beforeEach(() => localStorage.clear());

  it('seçilen adedi ve rengi sepete yazar', () => {
    const { result } = sepetiAc();
    act(() => result.current.addToCart(urun, 3, 'Kırmızı'));

    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0]).toMatchObject({ quantity: 3, color: 'Kırmızı', price: 2650 });
  });

  it('aynı ürün ve renk tekrar eklenince adetleri toplar', () => {
    const { result } = sepetiAc();
    act(() => result.current.addToCart(urun, 3, 'Kırmızı'));
    act(() => result.current.addToCart(urun, 2, 'Kırmızı'));

    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(5);
  });

  it('farklı renkleri ayrı satır tutar', () => {
    const { result } = sepetiAc();
    act(() => result.current.addToCart(urun, 1, 'Kırmızı'));
    act(() => result.current.addToCart(urun, 1, 'Siyah'));

    expect(result.current.cart.map((s) => s.color)).toEqual(['Kırmızı', 'Siyah']);
  });
});
