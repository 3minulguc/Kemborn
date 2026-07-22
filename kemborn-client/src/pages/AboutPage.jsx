import React from 'react';
import PageHeader from '../components/PageHeader';

const AboutPage = () => {
  return (
    <main className="pb-20">
      <PageHeader 
        title="Biz Kimiz?" 
        subtitle="Kemborn Intercom: Teknolojinin Yol Arkadaşı" 
      />

      <div className="max-w-4xl mx-auto px-6 space-y-12 text-zinc-700 leading-8">
        <section>
          <h2 className="text-2xl font-bold text-zinc-900 mb-4">Türk Patentli İnovasyon</h2>
          <p>
            Kemborn olarak, motosiklet tutkunlarının ihtiyaç duyduğu kesintisiz iletişim ve üstün ses teknolojilerini, 
            yerli mühendislik gücüyle birleştiriyoruz. Türk patentine sahip tek interkom sistemimizle, yollardaki 
            deneyiminizi daha güvenli, keyifli ve bağlantıda kalabildiğiniz bir serüvene dönüştürmeyi hedefliyoruz.
          </p>
        </section>

        <section className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-100">
          <h2 className="text-2xl font-bold text-zinc-900 mb-4">Vizyonumuz</h2>
          <p>
            Motosiklet dünyasında iletişim sınırlarını kaldırmak ve her sürüşü bir paylaşım anına dönüştürmek. 
            Ar-Ge süreçlerimizdeki titizliğimiz, kullanıcılarımıza sunduğumuz dayanıklılık ve ergonomi ile birleşerek 
            kendi standartlarımızı oluşturmamızı sağlıyor.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-zinc-900 mb-4">Neden Kemborn?</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Tamamen yerli tasarım ve Türk patentli teknoloji.</li>
            <li>Zorlu hava ve yol koşullarında test edilmiş dayanıklılık.</li>
            <li>Sürüş ergonomisini bozmayan şık ve kompakt tasarım.</li>
            <li>Maksimum ses netliği ve düşük gecikmeli Bluetooth bağlantısı.</li>
          </ul>
        </section>
      </div>
    </main>
  );
};

export default AboutPage;