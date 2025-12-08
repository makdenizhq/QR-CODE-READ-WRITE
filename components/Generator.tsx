import React, { useState, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Link, Type, Mail, Wifi, MapPin, Phone, Copy } from 'lucide-react';
import { QRType, WifiConfig, GeoConfig, EmailConfig } from '../types';
import { generateWifiString, generateGeoString, generateEmailString } from '../utils/qrUtils';

const Generator: React.FC = () => {
  const [selectedType, setSelectedType] = useState<QRType>(QRType.URL);
  const [qrValue, setQrValue] = useState<string>('https://google.com');
  
  // Specific inputs state
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [wifiInput, setWifiInput] = useState<WifiConfig>({ ssid: '', password: '', encryption: 'WPA' });
  const [geoInput, setGeoInput] = useState<GeoConfig>({ lat: '', lng: '' });
  const [emailInput, setEmailInput] = useState<EmailConfig>({ to: '', subject: '', body: '' });

  const qrRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `qrcode-${Date.now()}.png`;
      link.href = url;
      link.click();
    }
  };

  // Update Main QR Value based on type and inputs
  React.useEffect(() => {
    switch (selectedType) {
      case QRType.URL:
        setQrValue(urlInput || 'https://');
        break;
      case QRType.TEXT:
        setQrValue(textInput || ' ');
        break;
      case QRType.PHONE:
        setQrValue(phoneInput ? `tel:${phoneInput}` : 'tel:');
        break;
      case QRType.WIFI:
        setQrValue(generateWifiString(wifiInput.ssid, wifiInput.password, wifiInput.encryption));
        break;
      case QRType.GEO:
        setQrValue(generateGeoString(geoInput.lat, geoInput.lng));
        break;
      case QRType.EMAIL:
        setQrValue(generateEmailString(emailInput.to, emailInput.subject, emailInput.body));
        break;
    }
  }, [selectedType, urlInput, textInput, phoneInput, wifiInput, geoInput, emailInput]);

  const tabs = [
    { id: QRType.URL, icon: Link, label: 'Link' },
    { id: QRType.TEXT, icon: Type, label: 'Metin' },
    { id: QRType.WIFI, icon: Wifi, label: 'WiFi' },
    { id: QRType.EMAIL, icon: Mail, label: 'Email' },
    { id: QRType.GEO, icon: MapPin, label: 'Konum' },
    { id: QRType.PHONE, icon: Phone, label: 'Tel' },
  ];

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-white overflow-y-auto pb-24">
      {/* Top Preview Section */}
      <div className="sticky top-0 z-20 bg-neutral-900/80 backdrop-blur-lg border-b border-white/10 p-6 flex flex-col items-center justify-center shadow-lg">
        <div className="p-3 bg-white rounded-xl shadow-2xl" ref={qrRef}>
          <QRCodeCanvas 
            value={qrValue} 
            size={180} 
            level={"H"}
            bgColor={"#ffffff"}
            fgColor={"#000000"}
            includeMargin={true}
          />
        </div>
        <button 
          onClick={handleDownload}
          className="mt-4 flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-full font-medium transition-all active:scale-95 shadow-lg shadow-indigo-500/25"
        >
          <Download className="w-4 h-4" />
          <span>İndir (PNG)</span>
        </button>
      </div>

      {/* Type Selector */}
      <div className="px-4 py-6">
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedType(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors border ${
                selectedType === t.id 
                  ? 'bg-white text-black border-white' 
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:bg-neutral-800'
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Input Forms */}
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {selectedType === QRType.URL && (
            <div className="space-y-2">
              <label className="text-sm text-neutral-400 ml-1">Web Adresi (URL)</label>
              <input
                type="url"
                placeholder="https://example.com"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
            </div>
          )}

          {selectedType === QRType.TEXT && (
            <div className="space-y-2">
              <label className="text-sm text-neutral-400 ml-1">İçerik Metni</label>
              <textarea
                rows={4}
                placeholder="Buraya metin giriniz..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
            </div>
          )}

          {selectedType === QRType.PHONE && (
            <div className="space-y-2">
               <label className="text-sm text-neutral-400 ml-1">Telefon Numarası</label>
              <input
                type="tel"
                placeholder="+90 555 123 45 67"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white focus:outline-none focus:border-indigo-500 transition-all"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
              />
            </div>
          )}

          {selectedType === QRType.WIFI && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-neutral-400 ml-1">Ağ Adı (SSID)</label>
                <input
                  type="text"
                  placeholder="WiFi Adı"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white focus:outline-none focus:border-indigo-500 transition-all"
                  value={wifiInput.ssid}
                  onChange={(e) => setWifiInput({ ...wifiInput, ssid: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-neutral-400 ml-1">Şifre</label>
                <input
                  type="text" // Visible for QR creation convenience usually
                  placeholder="WiFi Şifresi"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white focus:outline-none focus:border-indigo-500 transition-all"
                  value={wifiInput.password}
                  onChange={(e) => setWifiInput({ ...wifiInput, password: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                 <label className="text-sm text-neutral-400 ml-1">Güvenlik Tipi</label>
                 <select
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white focus:outline-none focus:border-indigo-500 transition-all appearance-none"
                  value={wifiInput.encryption}
                  onChange={(e) => setWifiInput({ ...wifiInput, encryption: e.target.value as any })}
                 >
                   <option value="WPA">WPA/WPA2</option>
                   <option value="WEP">WEP</option>
                   <option value="nopass">Şifresiz</option>
                 </select>
              </div>
            </div>
          )}

          {selectedType === QRType.GEO && (
            <div className="space-y-4">
              <div className="space-y-2">
                 <label className="text-sm text-neutral-400 ml-1">Enlem (Latitude)</label>
                <input
                  type="text"
                  placeholder="41.0082"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white focus:outline-none focus:border-indigo-500 transition-all"
                  value={geoInput.lat}
                  onChange={(e) => setGeoInput({ ...geoInput, lat: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-neutral-400 ml-1">Boylam (Longitude)</label>
                <input
                  type="text"
                  placeholder="28.9784"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white focus:outline-none focus:border-indigo-500 transition-all"
                  value={geoInput.lng}
                  onChange={(e) => setGeoInput({ ...geoInput, lng: e.target.value })}
                />
              </div>
              <button 
                onClick={() => {
                   if (navigator.geolocation) {
                     navigator.geolocation.getCurrentPosition((pos) => {
                       setGeoInput({
                         lat: pos.coords.latitude.toString(),
                         lng: pos.coords.longitude.toString()
                       })
                     })
                   }
                }}
                className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-indigo-400 rounded-xl text-sm font-medium transition-colors"
              >
                Mevcut Konumumu Kullan
              </button>
            </div>
          )}

          {selectedType === QRType.EMAIL && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-neutral-400 ml-1">Alıcı E-posta</label>
                <input
                  type="email"
                  placeholder="ornek@site.com"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white focus:outline-none focus:border-indigo-500 transition-all"
                  value={emailInput.to}
                  onChange={(e) => setEmailInput({ ...emailInput, to: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-neutral-400 ml-1">Konu</label>
                <input
                  type="text"
                  placeholder="Konu başlığı"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white focus:outline-none focus:border-indigo-500 transition-all"
                  value={emailInput.subject}
                  onChange={(e) => setEmailInput({ ...emailInput, subject: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-neutral-400 ml-1">Mesaj</label>
                <textarea
                  rows={4}
                  placeholder="Mesaj içeriği..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white focus:outline-none focus:border-indigo-500 transition-all resize-none"
                  value={emailInput.body}
                  onChange={(e) => setEmailInput({ ...emailInput, body: e.target.value })}
                />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Generator;