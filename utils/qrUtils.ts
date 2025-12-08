import { QRType, ScannedResult } from '../types';

export const detectQRType = (data: string): QRType => {
  if (data.startsWith('http://') || data.startsWith('https://') || data.startsWith('www.')) return QRType.URL;
  if (data.startsWith('mailto:')) return QRType.EMAIL;
  if (data.startsWith('tel:')) return QRType.PHONE;
  if (data.startsWith('WIFI:')) return QRType.WIFI;
  if (data.startsWith('geo:')) return QRType.GEO;
  return QRType.TEXT;
};

export const performAction = (data: string, type: QRType) => {
  console.log(`Performing action for ${type}: ${data}`);
  
  switch (type) {
    case QRType.URL:
      let url = data;
      if (data.startsWith('www.')) url = `https://${data}`;
      window.open(url, '_blank');
      break;

    case QRType.EMAIL:
      window.location.href = data;
      break;

    case QRType.PHONE:
      window.location.href = data;
      break;

    case QRType.GEO:
      // geo:37.786971,-122.399677
      // Open in Google Maps
      const coords = data.replace('geo:', '');
      window.open(`https://www.google.com/maps/search/?api=1&query=${coords}`, '_blank');
      break;

    case QRType.WIFI:
      // Browsers cannot auto-connect to WiFi due to security.
      // We will parse it and let the UI show a copy password option.
      alert('WiFi Ağı bulundu. Şifreyi kopyalamak için panoya bakınız (Güvenlik nedeniyle tarayıcılar otomatik bağlanamaz).');
      break;

    default:
      // Text
      if (navigator.clipboard) {
        navigator.clipboard.writeText(data);
        alert('Metin panoya kopyalandı.');
      }
      break;
  }
};

export const generateWifiString = (ssid: string, pass: string, encryption: string) => {
  return `WIFI:T:${encryption};S:${ssid};P:${pass};;`;
};

export const generateGeoString = (lat: string, lng: string) => {
  return `geo:${lat},${lng}`;
};

export const generateEmailString = (to: string, subject: string, body: string) => {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};