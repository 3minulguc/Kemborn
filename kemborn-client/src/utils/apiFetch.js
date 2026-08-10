import { API_URL } from '../config/api';
import { getToken, clearSession, notifySessionExpired } from './auth';

// Kimlik gerektiren tüm istekler buradan geçiyor.
//
// Önceden her dosya token'ı kendi okuyup Authorization başlığını elle kuruyordu;
// bir yerde unutulursa istek sessizce yetkisiz gidiyordu. Ayrıca token süresi
// dolduğunda kimse fark etmiyordu — kullanıcı boş bir sayfaya bakıp kalıyordu.
// Artık 401 dönen her istekte oturum temizlenip haber veriliyor.
export const apiFetch = async (path, options = {}) => {
  const { headers = {}, body, ...rest } = options;
  const token = getToken();

  const finalHeaders = { ...headers };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  // Dosya yüklemede Content-Type'ı tarayıcı kendi belirlemeli (boundary ekliyor),
  // elle koyarsak yükleme bozulur.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData && !finalHeaders['Content-Type']) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  const response = await fetch(url, { ...rest, body, headers: finalHeaders });

  // Sadece elinde token varken 401 almak "oturum bitti" demek. Token'ı olmayan
  // birinin 401 alması normal, onu çıkışa düşürmenin anlamı yok.
  if (response.status === 401 && token) {
    clearSession();
    notifySessionExpired();
  }

  return response;
};
