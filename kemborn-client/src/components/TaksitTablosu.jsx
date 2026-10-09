import { formatPrice } from '../utils/format';
import { taksitliTutar, aylikTutar, programGruplari } from '../utils/taksit';

const TaksitTablosu = ({ fiyat, veri }) => {
  if (!veri) return <p>Taksit seçenekleri yükleniyor…</p>;
  const gruplar = veri.maxTaksit ? programGruplari(veri.oranlar, veri.maxTaksit) : [];
  if (gruplar.length === 0) return <p>Bu ürün için şu an taksit seçeneği bulunmuyor.</p>;

  return (
    <div className="space-y-6 whitespace-normal">
      {gruplar.map(({ programlar, satirlar }) => (
        <div key={programlar.join()}>
          <p className="text-sm md:text-base text-zinc-600 mb-3">
            <span className="font-bold text-zinc-900">Geçerli kartlar:</span> {programlar.join(', ')}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-zinc-200">
            <table className="w-full text-sm md:text-base">
              <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left font-black px-3 md:px-4 py-3">Taksit</th>
                  <th className="text-right font-black px-3 md:px-4 py-3">Aylık</th>
                  <th className="text-right font-black px-3 md:px-4 py-3">Toplam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                <tr>
                  <td className="px-3 md:px-4 py-3 font-bold text-zinc-900 whitespace-nowrap">Tek Çekim</td>
                  <td className="px-3 md:px-4 py-3 text-right">—</td>
                  <td className="px-3 md:px-4 py-3 text-right font-bold text-zinc-900 whitespace-nowrap">{formatPrice(fiyat)} TL</td>
                </tr>
                {satirlar.map(([sayi, oran]) => {
                  const toplam = taksitliTutar(fiyat, oran);
                  return (
                    <tr key={sayi}>
                      <td className="px-3 md:px-4 py-3 font-bold text-zinc-900 whitespace-nowrap">{sayi} Taksit</td>
                      <td className="px-3 md:px-4 py-3 text-right whitespace-nowrap">{formatPrice(aylikTutar(toplam, sayi))} TL</td>
                      <td className="px-3 md:px-4 py-3 text-right font-bold text-zinc-900 whitespace-nowrap">{formatPrice(toplam)} TL</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <p className="text-xs md:text-sm text-zinc-500">
        Tutarlar tek adet ürün içindir, kargo hariçtir. Banka kartlarında ve ticari kartlarda taksit
        yapılamaz. Kesin tutar, ödeme adımında kartınıza göre gösterilir.
      </p>
    </div>
  );
};

export default TaksitTablosu;
