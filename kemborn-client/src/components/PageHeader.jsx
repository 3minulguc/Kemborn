
const PageHeader = ({ title }) => (
  <div className="max-w-7xl mx-auto px-4 py-16 text-center">
    {/* font-black yerine font-bold kullanılarak başlık zarifleştirildi */}
    <h1 className="text-4xl font-bold text-zinc-900">{title}</h1>
    <div className="w-24 h-1 bg-cyan-600 mx-auto mt-4 rounded-full"></div>
  </div>
);

export default PageHeader;