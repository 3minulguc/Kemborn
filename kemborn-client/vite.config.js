import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // SİLDİĞİMİZ EKSİK buydu!

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss() // Tailwind motorunu tekrar çalıştırıyoruz
  ],
  test: {
    // jsdom: bazı testler localStorage/DOM kullanıyor (utils/auth.js,
    // utils/sanitize.js). Varsayılan 'node' ortamında bunlar tanımsız kalır.
    environment: 'jsdom'
  }
})