import { useEffect, useState } from 'react';
import { apiFetch } from '../utils/apiFetch';

// PayTR panelindeki taksit oranları (sunucu saatlik önbellekten veriyor).
// Sayfa başına bir kez çekiliyor; aynı oturumda tekrar gerekmiyor.
let onbellek = null;

export const useTaksitOranlari = () => {
  const [veri, setVeri] = useState(onbellek);

  useEffect(() => {
    if (onbellek) return;
    let iptal = false;
    apiFetch('/api/taksit-oranlari')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return;
        onbellek = d;
        if (!iptal) setVeri(d);
      })
      .catch(() => {});
    return () => { iptal = true; };
  }, []);

  return veri; // null | { maxTaksit, oranlar: { bonus: { 2: 7.63, ... } } }
};
