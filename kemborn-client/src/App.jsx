import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import ScrollToTop from './components/ScrollToTop'; // 1. Importu ekledik

// Layoutlar
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import UserLayout from './layouts/UserLayout';

// Sayfalar
import HomePage from './pages/HomePage';
import ProductDetail from './pages/ProductDetail';
import ProductsPage from './pages/ProductsPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import PolicyPage from './pages/PolicyPage';
import DeliveryPage from './pages/DeliveryPage';
import MesafeliSatisPage from './pages/DistanceSellingPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import SuccessPage from './pages/SuccessPage';
import AuthPage from './pages/AuthPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// Admin Sayfaları
import Dashboard from './pages/admin/Dashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminOrders from './pages/admin/AdminOrders';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminSettings from './pages/admin/AdminSettings';

// User Sayfaları
import ProfilePage from './pages/user/ProfilePage';
import OrdersPage from './pages/user/OrdersPage';
import FavoritesPage from './pages/user/FavoritesPage';
import SettingsPage from './pages/user/SettingsPage';
import OrderDetailPage from './pages/user/OrderDetailPage';

function App() {
  return (
    <Router>
      <ScrollToTop /> {/* 2. Router'ın hemen içine ekledik */}
      <AuthProvider>
        <CartProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#18181B',
                color: '#fff',
                fontWeight: 700,
                fontSize: '14px',
                borderRadius: '16px',
                padding: '14px 18px',
                boxShadow: '0 10px 30px -5px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.06)'
              },
              success: {
                iconTheme: { primary: '#06b6d4', secondary: '#18181B' }
              },
              error: {
                iconTheme: { primary: '#f43f5e', secondary: '#18181B' }
              },
              loading: {
                iconTheme: { primary: '#a1a1aa', secondary: '#18181B' }
              }
            }}
          />
          <Routes>
            {/* Genel Site & Üye Paneli */}
            <Route element={<MainLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/policy" element={<PolicyPage />} />
              <Route path="/delivery" element={<DeliveryPage />} />
              <Route path="/mesafeli-satis-sozlesmesi" element={<MesafeliSatisPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/success" element={<SuccessPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Üye Paneli */}
              <Route path="/profile" element={<PrivateRoute><UserLayout /></PrivateRoute>}>
                <Route index element={<ProfilePage />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="orders/:id" element={<OrderDetailPage />} /> 
                <Route path="favorites" element={<FavoritesPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>

            {/* Admin Paneli */}
            <Route path="/admin" element={<PrivateRoute adminOnly={true}><AdminLayout /></PrivateRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
          </Routes>
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;