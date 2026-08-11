import YasalIcerik from '../components/YasalIcerik';
import metin from '../content/yasal/teslimat-iade.html?raw';

const DeliveryPage = () => (
  <YasalIcerik
    baslik="Teslimat ve İade"
    html={metin}
  />
);

export default DeliveryPage;
