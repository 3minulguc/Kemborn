import PageHeader from '../components/PageHeader';
import { Link } from 'react-router-dom';
import { FiShield, FiRefreshCw, FiTool } from 'react-icons/fi';

// Müşteriye güven veren üç somut söz. Hakkımızda sayfasının en çok okunan
// yeri burası olduğu için yazının içine gömmek yerine ayrı kartlara alındı;
// satın almadan önce merak edilen "bozulursa ne olur, beğenmezsem ne olur"
// sorularının cevabı bunlar.
const GUVENCELER = [
  {
    ikon: FiShield,
    baslik: '1 Yıl Garanti',
    metin: 'Tüm Kemborn ürünleri, Kemborn tarafından doğrudan sağlanan 1 yıl garantilidir. Kullanım sırasında ortaya çıkan arızalarda ürün ücretsiz onarılır.'
  },
  {
    ikon: FiRefreshCw,
    baslik: '14 Gün İade',
    metin: 'Ürünü kaskınıza takmadan inceleyip beğenmezseniz, 14 gün içinde gerekçe göstermeden iade edebilirsiniz. İade kargosu bize ait.'
  },
  {
    ikon: FiTool,
    baslik: 'Tamir Garantisi',
    metin: 'Garanti kapsamındaki arızalarda ürünü değiştirmek yerine onarıyoruz; yedek parça ve teknik destek bizde.'
  }
];

const AboutPage = () => {
  return (
    <main className="pb-20">
      <PageHeader
        title="Biz Kimiz?"
        subtitle="Kemborn Intercom: Teknolojinin Yol Arkadaşı"
      />

      <div className="max-w-4xl mx-auto px-6 space-y-12 text-zinc-700 leading-8">
        <section>
          <h2 className="text-2xl font-bold text-zinc-900 mb-4">Türkiye'nin Kendi İnterkomu</h2>
          <p>
            Kemborn, <strong className="text-zinc-900">Türk patenti ile üretilen bir motosiklet
            interkom sistemidir</strong>. Tasarımdan üretime kadar her aşama yerli mühendislikle yürütülüyor;
            ürünü biz geliştiriyor, biz üretiyor ve arkasında biz duruyoruz.
          </p>
          <p className="mt-4">
            Bunun müşteri için pratik karşılığı şu: bir sorun çıktığında muhatabınız yurt dışındaki bir
            üretici değil, doğrudan biziz. Yedek parça, teknik destek ve onarım süreci ithal ürünlerdeki gibi
            aylar sürmüyor.
          </p>
        </section>

        {/* GÜVENCELER */}
        <section>
          <h2 className="text-2xl font-bold text-zinc-900 mb-6">Arkasında Durduğumuz Sözler</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {GUVENCELER.map((g) => {
              const Ikon = g.ikon;
              return (
                <div
                  key={g.baslik}
                  className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col gap-3"
                >
                  <Ikon size={24} className="text-cyan-600" />
                  <h3 className="text-base font-black text-zinc-900">{g.baslik}</h3>
                  <p className="text-sm leading-relaxed text-zinc-600">{g.metin}</p>
                </div>
              );
            })}
          </div>
          <p className="text-sm text-zinc-500 mt-4">
            Ayrıntılar için{' '}
            <Link to="/delivery" className="font-bold text-cyan-600 hover:text-cyan-700 underline underline-offset-2">
              Teslimat ve İade
            </Link>{' '}
            sayfasına göz atabilirsiniz.
          </p>
        </section>

        <section className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-100">
          <h2 className="text-2xl font-bold text-zinc-900 mb-4">Vizyonumuz</h2>
          <p>
            Motosiklet dünyasında iletişim sınırlarını kaldırmak ve her sürüşü bir paylaşım anına dönüştürmek.
            Ar-Ge süreçlerimizdeki titizliğimiz, kullanıcılarımıza sunduğumuz dayanıklılık ve ergonomi ile
            birleşerek kendi standartlarımızı oluşturmamızı sağlıyor.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-zinc-900 mb-4">Neden Kemborn?</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Türk patenti ile üretilen interkom sistemi.</li>
            <li>Tamamen yerli tasarım ve mühendislik.</li>
            <li>Zorlu hava ve yol koşullarında test edilmiş dayanıklılık.</li>
            <li>Sürüş ergonomisini bozmayan şık ve kompakt tasarım.</li>
            <li>Maksimum ses netliği ve düşük gecikmeli Bluetooth bağlantısı.</li>
            <li>Yerli servis: yedek parça ve onarım için yurt dışı beklemek yok.</li>
          </ul>
        </section>
      </div>
    </main>
  );
};

export default AboutPage;
