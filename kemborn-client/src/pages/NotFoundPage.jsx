import { Link } from 'react-router-dom';
import { FiHome, FiShoppingBag, FiSearch } from 'react-icons/fi';

// Bilinmeyen bir adrese gidildiğinde gösterilir.
// Önceden App.jsx'te path="*" rotası yoktu; yanlış bir adres yazan ya da eski
// bir bağlantıya tıklayan ziyaretçi bomboş bir sayfa görüyordu.
const NotFoundPage = () => (
  <main className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16 bg-white text-center">
    <p className="text-7xl sm:text-8xl font-black text-zinc-200 tracking-tighter select-none">404</p>

    <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 mt-2 mb-4 tracking-tight">
      Aradığınız sayfa bulunamadı
    </h1>

    <p className="text-zinc-500 font-medium max-w-md leading-relaxed">
      Adres yanlış yazılmış olabilir ya da bu sayfa kaldırılmış olabilir.
      Aşağıdan devam edebilirsiniz.
    </p>

    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mt-8">
      <Link
        to="/"
        className="flex-1 bg-zinc-900 text-white px-6 min-h-[52px] rounded-2xl font-black hover:bg-cyan-600 transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95"
      >
        <FiHome size={20} /> Ana Sayfa
      </Link>
      <Link
        to="/products"
        className="flex-1 bg-zinc-50 text-zinc-900 border border-zinc-200 px-6 min-h-[52px] rounded-2xl font-black hover:bg-zinc-100 transition-all flex items-center justify-center gap-2 active:scale-95"
      >
        <FiShoppingBag size={20} /> Ürünler
      </Link>
    </div>

    <Link
      to="/contact"
      className="mt-8 text-sm font-black text-cyan-600 hover:text-cyan-700 flex items-center gap-2 min-h-[44px] px-4"
    >
      <FiSearch size={16} /> Aradığınızı bulamadınız mı? Bize ulaşın
    </Link>
  </main>
);

export default NotFoundPage;
