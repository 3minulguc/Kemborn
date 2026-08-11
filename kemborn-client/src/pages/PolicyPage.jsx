import YasalIcerik from '../components/YasalIcerik';
import metin from '../content/yasal/kvkk-gizlilik.html?raw';

const PolicyPage = () => (
  <YasalIcerik
    baslik="Gizlilik ve KVKK Aydınlatma Metni"
    html={metin}
  />
);

export default PolicyPage;
