import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const PrivateRoute = ({ children, adminOnly }) => {
  const { isAuthenticated, user } = useAuth();

  // Giriş yapmamışsa veya token süresi dolmuşsa direkt auth sayfasına postala
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  // Admin yetkisi gerekiyorsa ve giriş yapanın rolü 'admin' değilse ana sayfaya postala
  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Her şey yolundaysa sayfayı göster
  return children;
};

export default PrivateRoute;