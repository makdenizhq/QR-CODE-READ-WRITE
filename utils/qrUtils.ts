import { QRType, ScannedResult } from '../types';

export const detectQRType = (data: string): QRType => {
  if (data.startsWith('http://') || data.startsWith('https://') || data.startsWith('www.')) return QRType.URL;
  if (data.startsWith('mailto:')) return QRType.EMAIL;
  if (data.startsWith('tel:')) return QRType.PHONE;
  if (data.startsWith('WIFI:')) return QRType.WIFI;
  if (data.startsWith('geo:')) return QRType.GEO;
  return QRType.TEXT;
};

// Helper to safely handle clipboard operations which might be blocked by browsers
// if not triggered by explicit user interaction or if document lacks focus.
const safeCopy = async (text: string) => {
  if (!navigator.clipboard) return;
  try {
    // Attempt to focus window first if possible (helps in some iframe contexts)
    if (window.focus) window.focus();
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.warn("Clipboard write failed (likely due to lack of user gesture or focus):", err);
  }
};

export const performAction = (data: string, type: QRType) => {
  console.log(`Performing action for ${type}: ${data}`);
  
  switch (type) {
    case QRType.URL:
      let url = data;
      if (data.startsWith('www.')) url = `https://${data}`;
      // Open immediately
      // Note: Some browsers might block popups here since this isn't a direct click event.
      const newWindow = window.open(url, '_blank');
      // Fallback if popup blocked: Redirect current window
      if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
         window.location.href = url;
      }
      break;

    case QRType.EMAIL:
      window.location.href = data;
      break;

    case QRType.PHONE:
      window.location.href = data;
      break;

    case QRType.GEO:
      // geo:37.786971,-122.399677
      const coords = data.replace('geo:', '');
      window.open(`https://www.google.com/maps/search/?api=1&query=${coords}`, '_blank');
      break;

    case QRType.WIFI:
      // Extract password assuming standard format: WIFI:T:WPA;S:MyNetwork;P:MyPass;;
      const passMatch = data.match(/P:([^;]+)/);
      if (passMatch && passMatch[1]) {
        safeCopy(passMatch[1]);
        // Stronger feedback for silent success
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }
      // No alert, just silent copy and vibrate
      break;

    default:
      // Text - Copy immediately and silently
      safeCopy(data);
      if (navigator.vibrate) navigator.vibrate(100);
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