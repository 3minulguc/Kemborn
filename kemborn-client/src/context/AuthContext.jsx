import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

// Token'ın süresinin dolup dolmadığını kontrol eden yardımcı fonksiyon
const isTokenValid = (token) => {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch (error) {
    return false;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      // Artık tüm verileri sekmeye özel olan sessionStorage'dan okuyoruz
      const token = sessionStorage.getItem('kemborn_token');
      const savedUser = sessionStorage.getItem('kemborn_user');
      
      if (token && savedUser && isTokenValid(token)) {
        return JSON.parse(savedUser);
      }
      
      sessionStorage.removeItem('kemborn_user');
      sessionStorage.removeItem('kemborn_token');
      return null;
    } catch (error) {
      return null;
    }
  });

  const login = (userData, token) => {
    setUser(userData);
    // Verileri kalıcı hafıza yerine oturum hafızasına kaydediyoruz
    sessionStorage.setItem('kemborn_user', JSON.stringify(userData));
    sessionStorage.setItem('kemborn_token', token);
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('kemborn_user');
    sessionStorage.removeItem('kemborn_token');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated: !!user && isTokenValid(sessionStorage.getItem('kemborn_token')), 
      login, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);