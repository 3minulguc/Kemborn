import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getToken,
  getStoredUser,
  isTokenValid,
  saveSession,
  clearSession,
  SESSION_EXPIRED_EVENT
} from '../utils/auth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();

  const [user, setUser] = useState(() => {
    const token = getToken();
    const savedUser = getStoredUser();

    if (token && savedUser && isTokenValid(token)) {
      return savedUser;
    }

    // Süresi dolmuş ya da yarım kalmış kayıt varsa temizle.
    clearSession();
    return null;
  });

  // remember=true ise oturum tarayıcı kapansa da duruyor (localStorage),
  // false ise sekme kapanınca bitiyor (sessionStorage) — eski davranış.
  const login = useCallback((userData, token, remember = false) => {
    saveSession(userData, token, remember);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  // Sunucu 401 döndüğünde apiFetch haber veriyor; kullanıcı sessizce boş
  // sayfaya bakmak yerine bilgilendirilip giriş ekranına alınıyor.
  useEffect(() => {
    const handleExpired = () => {
      // Zaten çıkmış birine tekrar "oturumun bitti" demenin anlamı yok.
      if (!user) return;
      setUser(null);
      toast.error('Oturumunuzun süresi doldu, lütfen tekrar giriş yapın.');
      navigate('/auth');
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, [user, navigate]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user && isTokenValid(getToken()),
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
