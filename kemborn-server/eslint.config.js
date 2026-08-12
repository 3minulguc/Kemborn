// Sunucu tarafı ESLint yapılandırması.
//
// NEDEN VAR: server.js 23 dosyaya bölünürken iki kez aynı hata yapıldı —
// bir fonksiyon taşındı ama dışa aktarılmadı/import edilmedi, kod yine de
// çalıştı ve hata ancak o satıra gelen ilk istekte 500 olarak patladı:
//
//   isAdminUser   sipariş detayını açmaya çalışınca (b186f88'de yakalandı)
//   round2        gerçek bir siparişle ödeme başlatınca (19db1ef'te)
//
// İkisi de no-undef kuralının anında göreceği hatalar. Bu dosyanın tek
// gerçek işi o kuralı çalıştırmak; geri kalanı gürültü yapmasın diye ölçülü.

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/**', 'uploads/**', 'logs/**']
  },
  js.configs.recommended,
  {
    // .mjs dosyaları (scripts/) ES modülü ve ayrı ele alınmalı: aynı blokta
    // commonjs olarak işaretlenirlerse import/export sözdizimi hata veriyor,
    // globals verilmezse de console/process/fetch "tanımsız" görünüyor.
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node }
    }
  },
  {
    // Test dosyaları Vitest'in gerektirdiği ES modülü söz dizimini (import/
    // export) kullanıyor; sunucunun geri kalanı CommonJS. İkisi ayrı
    // sourceType istiyor, aynı .js blokta çakışıyorlardı.
    files: ['**/__tests__/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node }
    }
  },
  {
    files: ['**/*.js'],
    ignores: ['**/__tests__/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        // Node 18+ ile gelen, globals paketinin bazı sürümlerinde eksik kalanlar
        fetch: 'readonly',
        URLSearchParams: 'readonly'
      }
    },
    rules: {
      // Asıl sebep buradaki iki kural:
      'no-undef': 'error',
      'no-unused-vars': ['error', {
        // Yakalanan ama kullanılmayan hata değişkeni yaygın ve zararsız:
        //   catch (err) { res.status(500)... }
        caughtErrors: 'none',
        // Express hata middleware'i DÖRT parametre almak zorunda; next
        // kullanılmasa bile silinemez, yoksa Express onu normal middleware sanar.
        argsIgnorePattern: '^next$'
      }],

      // Bilerek kapatıldı: sunucuda console.log/console.error asıl günlük
      // mekanizmasının parçası (logToFile'ın yanında terminale de yazıyoruz).
      'no-console': 'off'
    }
  }
];
