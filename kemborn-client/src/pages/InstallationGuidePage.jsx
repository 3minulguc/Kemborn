import React from 'react';
import PageHeader from '../components/PageHeader';
import { FiPlayCircle, FiFileText, FiClock } from 'react-icons/fi';

const InstallationGuidePage = () => {
  return (
    <main className="pb-32 font-sans bg-zinc-50/50 min-h-screen">
      <PageHeader title="Kurulum Rehberi" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-8">
        <p className="text-center text-zinc-500 font-medium mb-10 max-w-xl mx-auto">
          Tüm Kemborn intercom modelleri aynı kurulum adımlarını takip eder. Bu sayfada
          kurulumu adım adım, hem video hem yazılı anlatımla bulabileceksiniz.
        </p>

        <div className="bg-white rounded-[2rem] border border-zinc-200 shadow-sm p-10 sm:p-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-cyan-50 text-cyan-600 rounded-full flex items-center justify-center mb-6">
            <FiClock size={32} />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 mb-3">Yakında Burada</h2>
          <p className="text-sm sm:text-base text-zinc-500 font-medium max-w-md mb-8">
            Kurulum videosunu ve adım adım yazılı rehberi hazırlıyoruz. Çok yakında bu sayfada
            yer alacak.
          </p>

          <div className="flex items-center gap-6 text-zinc-300">
            <div className="flex items-center gap-2 text-sm font-bold">
              <FiPlayCircle size={20} /> Video
            </div>
            <div className="w-1 h-1 rounded-full bg-zinc-200" />
            <div className="flex items-center gap-2 text-sm font-bold">
              <FiFileText size={20} /> Yazılı Anlatım
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default InstallationGuidePage;
