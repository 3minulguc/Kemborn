import { createContext } from 'react';

// Context nesneleri bilerek AYRI bir dosyada.
//
// Provider bileşenleriyle (AuthContext.jsx / CartContext.jsx) aynı dosyada
// dursalardı, o dosyalar hem bileşen hem bileşen olmayan bir şey export
// etmiş olurdu. Vite'ın hızlı yenilemesi (fast refresh) bu durumda dosyayı
// güvenle tazeleyemiyor ve tüm uygulama state'ini sıfırlıyor: geliştirirken
// tek satır değiştirince sepet boşalıyor, oturum kapanıyor.
//
// Aynı sebeple useAuth/useCart kancaları da hooks/ altında ayrı duruyor.
export const AuthContext = createContext();
export const CartContext = createContext();
