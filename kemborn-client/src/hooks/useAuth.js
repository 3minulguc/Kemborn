import { useContext } from 'react';
import { AuthContext } from '../context/contexts';

// Oturum bilgisine erişim: user, isAuthenticated, login, logout.
// AuthProvider'ın içinde çağrılmalı.
export const useAuth = () => useContext(AuthContext);
