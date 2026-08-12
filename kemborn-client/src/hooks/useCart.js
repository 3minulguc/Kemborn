import { useContext } from 'react';
import { CartContext } from '../context/contexts';

// Sepete erişim: cart, addToCart, removeFromCart, clearCart vb.
// CartProvider'ın içinde çağrılmalı.
export const useCart = () => useContext(CartContext);
