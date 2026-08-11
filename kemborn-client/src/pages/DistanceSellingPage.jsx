import YasalIcerik from '../components/YasalIcerik';
import metin from '../content/yasal/mesafeli-satis.html?raw';

const DistanceSellingPage = () => (
  <YasalIcerik
    baslik="Mesafeli Satış Sözleşmesi"
    html={metin}
  />
);

export default DistanceSellingPage;
