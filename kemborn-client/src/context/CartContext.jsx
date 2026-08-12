import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { CartContext } from './contexts';
import { useAuth } from '../hooks/useAuth';


// Sepet, giriş yapan kullanıcıya özel bir anahtarda saklanır. Böylece:
// - Bir kullanıcı çıkış yapıp tekrar giriş yaptığında KENDİ sepeti duruyor olur.
// - Aynı bilgisayarda farklı bir kullanıcı giriş yaptığında ÖNCEKİ kullanıcının
//   sepetini GÖRMEZ (kendi sepeti - ya da misafir sepeti - yüklenir).
const getCartStorageKey = (userId) => `kemborn-cart-${userId || 'guest'}`;

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState([]);
  // Bu bayrak, "az önce sepeti diskten yükledik, bu değişikliği tekrar diske
  // yazma" demek için var. Yoksa yükleme ile kaydetme aynı anda çakışıp
  // henüz yüklenmemiş boş sepeti yanlışlıkla diskin üzerine yazabiliyordu.
  const justLoaded = useRef(true);

  // Giriş yapan kullanıcı değiştiğinde (giriş/çıkış), o kullanıcıya ait
  // kayıtlı sepeti yükle. Sayfa ilk açıldığında da aynı mantıkla çalışır.
  //
  // BİLEREK effect'te bırakıldı. react-hooks kuralı burayı "türetilmiş durum"
  // sanıp render sırasında yapılmasını istiyor, ama bu effect hemen alttaki
  // kaydetme effect'iyle justLoaded bayrağı üzerinden eşleşiyor: sıralamayı
  // bozan bir değişiklik, yeni yüklenen sepetin üstüne boş sepeti yazar ve
  // müşterinin sepeti sessizce boşalır. Bu dosyanın testi de yok. Lansmandan
  // sonra iki effect birlikte, testle beraber ele alınmalı.
  useEffect(() => {
    justLoaded.current = true;
    try {
      const savedCart = localStorage.getItem(getCartStorageKey(user?.id));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCart(savedCart ? JSON.parse(savedCart) : []);
    } catch {
      setCart([]);
    }
  }, [user?.id]);

  // Sepet her değiştiğinde, O ANKİ kullanıcının kendi anahtarına kaydet
  // (az önce diskten yüklediğimiz değişiklik hariç — onu tekrar yazmaya gerek yok)
  useEffect(() => {
    if (justLoaded.current) {
      justLoaded.current = false;
      return;
    }
    localStorage.setItem(getCartStorageKey(user?.id), JSON.stringify(cart));
  }, [cart, user?.id]);

  // FİYAT DÜZELTİCİ: String (1.220 TL) veya Sayı (1220) olarak gelen her şeyi sayıya çevirir
  const cleanPrice = (price) => {
    if (typeof price === 'number') return price;
    if (typeof price !== 'string') return 0;
    // Nokta, virgül ve para birimi kısımlarını temizleyip sadece rakamı bırakır
    return parseFloat(price.replace(/[^0-9.]/g, '')) || 0;
  };

  const addToCart = (product, quantity = 1, color = 'Siyah') => {
    const price = cleanPrice(product.price);
    const uniqueKey = `${product.id}-${color}`;

    setCart((prev) => {
      const existingItem = prev.find(item => item.uniqueKey === uniqueKey);

      if (existingItem) {
        return prev.map(item => 
          item.uniqueKey === uniqueKey 
            ? { ...item, quantity: item.quantity + quantity } 
            : item
        );
      }
      
      return [...prev, { 
        ...product, 
        price, 
        quantity, 
        color, 
        uniqueKey 
      }];
    });
    
    toast.success(`${product.name} sepete eklendi!`);
  };

  const increaseQuantity = (uniqueKey) => {
    setCart((prev) => prev.map((item) => 
      item.uniqueKey === uniqueKey 
        ? { ...item, quantity: item.quantity + 1 } 
        : item
    ));
  };

  const decreaseQuantity = (uniqueKey) => {
    setCart((prev) => prev.map((item) => 
      item.uniqueKey === uniqueKey && item.quantity > 1 
        ? { ...item, quantity: item.quantity - 1 } 
        : item
    ));
  };

  const removeFromCart = (uniqueKey) => {
    setCart((prev) => prev.filter((item) => item.uniqueKey !== uniqueKey));
  };

  // --- SEPETTEKİ BİR ÜRÜNÜN RENGİNİ DEĞİŞTİRME ---
  const updateColor = (oldUniqueKey, newColor) => {
    setCart((prev) => {
      const item = prev.find(i => i.uniqueKey === oldUniqueKey);
      if (!item || item.color === newColor) return prev;

      const newUniqueKey = `${item.id}-${newColor}`;
      const existingWithNewColor = prev.find(i => i.uniqueKey === newUniqueKey);

      if (existingWithNewColor) {
        // Sepette o renkte zaten bir satır varsa, miktarları birleştirip eski satırı kaldır
        return prev
          .filter(i => i.uniqueKey !== oldUniqueKey)
          .map(i => i.uniqueKey === newUniqueKey ? { ...i, quantity: i.quantity + item.quantity } : i);
      }

      return prev.map(i => i.uniqueKey === oldUniqueKey ? { ...i, color: newColor, uniqueKey: newUniqueKey } : i);
    });
  };

  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider value={{ 
      cart, 
      addToCart, 
      increaseQuantity, 
      decreaseQuantity, 
      removeFromCart, 
      updateColor,
      clearCart 
    }}>
      {children}
    </CartContext.Provider>
  );
};
