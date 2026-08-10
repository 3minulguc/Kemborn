// Oturumun (token + kullanıcı) nerede saklandığını bilen TEK yer.
//
// Önceden 15 dosya token'ı doğrudan sessionStorage'dan okuyordu; depolama yerini
// değiştirmek 15 dosyayı birden değiştirmek demekti. "Beni hatırla" da tam olarak
// bunu gerektiriyor: işaretliyse oturum kalıcı (localStorage), değilse sekmeye özel
// (sessionStorage) saklanıyor. Okuma tarafı ikisine de bakar, çağıran tarafın
// oturumun nerede olduğunu bilmesine gerek yok.

const TOKEN_KEY = 'kemborn_token';
const USER_KEY = 'kemborn_user';

// Oturum sunucuda geçersiz sayıldığında (401) haber vermek için kullanılıyor.
// AuthContext bunu dinleyip kullanıcıyı çıkışa düşürüyor.
export const SESSION_EXPIRED_EVENT = 'kemborn:oturum-bitti';

// Gizli sekmede depolama erişimi hata fırlatabiliyor; site çökmesin diye
// her erişim sarmalanıyor.
const safeGet = (store, key) => {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
};

const safeRemove = (store, key) => {
  try {
    store.removeItem(key);
  } catch {
    /* depolama kapalı — yapacak bir şey yok */
  }
};

export const getToken = () =>
  safeGet(localStorage, TOKEN_KEY) || safeGet(sessionStorage, TOKEN_KEY);

export const getStoredUser = () => {
  const raw = safeGet(localStorage, USER_KEY) || safeGet(sessionStorage, USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// Token'ın süresi dolmuş mu? İmzayı doğrulamaz — o sunucunun işi.
// Buradaki amaç, süresi geçmiş bir token'la boşuna istek atmamak.
export const isTokenValid = (token) => {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

export const saveSession = (user, token, remember = false) => {
  // Önce her iki depodan da temizle: "beni hatırla" işaretini kaldırıp tekrar
  // giren birinin eski kalıcı kaydı geride kalmasın.
  clearSession();

  const store = remember ? localStorage : sessionStorage;
  try {
    store.setItem(TOKEN_KEY, token);
    store.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* depolama dolu ya da kapalı — oturum yalnızca bellekte yaşar */
  }
};

export const clearSession = () => {
  safeRemove(localStorage, TOKEN_KEY);
  safeRemove(localStorage, USER_KEY);
  safeRemove(sessionStorage, TOKEN_KEY);
  safeRemove(sessionStorage, USER_KEY);
};

export const notifySessionExpired = () => {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
};
