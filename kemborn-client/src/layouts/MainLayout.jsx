import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ScrollToTop from '../components/ScrollToTop';
import BackToTop from '../components/BackToTop';

const MainLayout = () => {
  return (
    <div className="flex flex-col min-h-screen">
      {/* İkisi de içe aktarılmış ama hiç render edilmiyordu: sayfa değişince
          scroll sıfırlanmıyordu (önceki sayfada kaydırılmış konumda kalıyordu)
          ve "yukarı çık" butonu hiçbir zaman görünmüyordu. */}
      <ScrollToTop />
      <Header />
      <main className="flex-grow">
        <Outlet /> {/* Tüm sayfalar ve UserLayout buraya render olacak */}
      </main>
      <Footer />
      {/* Sağ kenardaki sabit pazaryeri butonu kaldırıldı: sepette ürün
          fiyatının üstünü örtüyordu ve "Yukarı Çık" butonuyla aynı köşeyi
          paylaşıyordu. Pazaryeri linkleri Mağazalarımız sayfasında,
          ana sayfadaki pazaryeri şeridinde ve footer'da zaten var. */}
      <BackToTop />
    </div>
  );
};
export default MainLayout;