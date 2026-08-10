// Safari, <select> ve <textarea> ögelerine macOS'un sistem vurgu rengini
// uyguluyor: kutu odaklanmamışken bile mavi görünüyor. Chrome'da aynı kod gri
// çıktığı için bu fark geliştirirken gözden kaçıyor.
//
// Çözüm iki parça:
//   1. appearance-none  — yerel görünümü kapatır
//   2. select'e kendi okumuz — yerel görünüm kapanınca açılır menü oku da
//      kayboluyor, yerine bir şey koymazsak kutu düz bir input gibi duruyor
//
// Ok neden Tailwind sınıfı DEĞİL de satır içi stil:
// Tailwind, üreteceği sınıfları kaynak dosyalarda TAM METİN olarak arıyor.
// Sınıf adı çalışma anında birleştirilirse (`bg-[url('${degisken}')]` gibi)
// tarayıcı onu hiç görmez ve CSS üretilmez. İlk denemede tam bu oldu: ok
// görünmedi, sağ dolgu bile uygulanmadı. Satır içi stil bu tuzağa düşmüyor.

const OK_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" ' +
  'fill="none" stroke="#71717a" stroke-width="2.5" stroke-linecap="round" ' +
  'stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
);

// Sağdaki dolgu BİLEREK var: ok, seçili metnin üstüne binmesin.
export const selectOkStyle = {
  backgroundImage: `url("data:image/svg+xml,${OK_SVG}")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.6rem center',
  backgroundSize: '1rem',
  paddingRight: '2.25rem'
};

// Bu iki sınıf kaynakta tam metin olarak duruyor, Tailwind görebiliyor.
export const selectStil = 'appearance-none';
export const textareaStil = 'appearance-none';
