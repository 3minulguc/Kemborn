import React from 'react';

// ==========================================
// HATA SINIRI (Error Boundary)
// ==========================================
// React'te bir bileşen render sırasında hata fırlatırsa, yakalayan bir sınır
// yoksa React TÜM ağacı söker ve ziyaretçi bomboş beyaz bir ekran görür.
// Tek bir ürün kartındaki beklenmedik veri, bütün siteyi kullanılamaz hale
// getirebiliyordu. Bu bileşen hatayı yakalar ve anlamlı bir ekran gösterir.
//
// NOT: Sınıf bileşeni olmak zorunda — React'te hata yakalama için
// componentDidCatch/getDerivedStateFromError yalnızca sınıflarda çalışıyor.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hataVar: false };
  }

  static getDerivedStateFromError() {
    return { hataVar: true };
  }

  componentDidCatch(hata, bilgi) {
    // Geliştirme sırasında konsolda görünsün; ileride bir hata izleme
    // servisine (Sentry vb.) buradan gönderilebilir.
    console.error('Beklenmeyen arayüz hatası:', hata, bilgi?.componentStack);
  }

  render() {
    if (!this.state.hataVar) return this.props.children;

    return (
      <main className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16 bg-white text-center">
        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-6 text-3xl font-black">
          !
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 mb-4 tracking-tight">
          Bir şeyler ters gitti
        </h1>

        <p className="text-zinc-500 font-medium max-w-md leading-relaxed">
          Sayfa yüklenirken beklenmeyen bir sorun oluştu. Sayfayı yenilemek
          genellikle sorunu çözer.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mt-8">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-zinc-900 text-white px-6 min-h-[52px] rounded-2xl font-black hover:bg-cyan-600 transition-all shadow-lg active:scale-95"
          >
            Sayfayı Yenile
          </button>
          <a
            href="/"
            className="flex-1 bg-zinc-50 text-zinc-900 border border-zinc-200 px-6 min-h-[52px] rounded-2xl font-black hover:bg-zinc-100 transition-all flex items-center justify-center active:scale-95"
          >
            Ana Sayfaya Dön
          </a>
        </div>

        <p className="text-xs text-zinc-400 font-medium mt-8">
          Sorun devam ederse{' '}
          <a href="/contact" className="text-cyan-600 font-bold underline underline-offset-2">
            bizimle iletişime geçin
          </a>
          .
        </p>
      </main>
    );
  }
}

export default ErrorBoundary;
