// Tüm API isteklerinin gittiği taban adres, TEK bir yerden yönetiliyor.
// Geliştirmede .env dosyası yoksa localhost:5005 kullanılır.
// Canlıya çıkarken .env.production içinde VITE_API_URL'i gerçek domain'inle değiştirmen yeterli,
// kod içindeki hiçbir dosyayı tek tek değiştirmene gerek kalmaz.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005';
