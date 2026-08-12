import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  analitigiBaslat,
  analitikCalisiyorMu,
  sayfaGoruntulendi,
  ONAY_OLAYI
} from '../utils/analitik';

// Görünmeyen bileşen. İki iş yapıyor:
//  1. Onay verilmişse ölçüm araçlarını bir kere yüklüyor (kullanıcı banner'da
//     "Kabul Et" dediği anda da, sayfa yenilenmeyi beklemeden).
//  2. Tek sayfalık uygulamada her rota değişiminde sayfa görüntüleme
//     gönderiyor — yoksa sadece ilk açılış sayılır.
const Analitik = () => {
  const location = useLocation();

  useEffect(() => {
    analitigiBaslat();
    const onayDegisti = () => {
      if (analitigiBaslat()) {
        // Yeni kabul edildi: bulunulan sayfa da sayılsın.
        sayfaGoruntulendi(window.location.pathname + window.location.search);
      }
    };
    window.addEventListener(ONAY_OLAYI, onayDegisti);
    return () => window.removeEventListener(ONAY_OLAYI, onayDegisti);
  }, []);

  useEffect(() => {
    if (!analitikCalisiyorMu()) return;
    sayfaGoruntulendi(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
};

export default Analitik;
