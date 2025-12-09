import React, { useState, useRef, useEffect } from 'react';
import { Bell, ArrowLeft, ArrowRight, Bluetooth, BluetoothConnected, BluetoothOff } from 'lucide-react';

// UUIDs must be lowercase for Web Bluetooth API compatibility
const BLE_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"; // Nordic UART Service
const BLE_CHARACTERISTIC_WRITE_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // RX Characteristic

const Intercom: React.FC = () => {
  const [display, setDisplay] = useState("DAİRE NO GİRİNİZ");
  const [input, setInput] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);

  // Bluetooth State
  const [isBleConnected, setIsBleConnected] = useState(false);
  const [bleError, setBleError] = useState<string | null>(null);
  const deviceRef = useRef<any>(null);
  const characteristicRef = useRef<any>(null);

  const initAudio = () => {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  // --- Bluetooth Logic Start ---
  
  const connectToDevice = async () => {
    setBleError(null);
    try {
      if (!(navigator as any).bluetooth) {
        setBleError("Tarayıcınız Bluetooth desteklemiyor (Chrome kullanın).");
        return;
      }

      console.log('Cihaz aranıyor...');
      // Request device with specific service UUID
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ namePrefix: 'Intercom' }], 
        optionalServices: [BLE_SERVICE_UUID]
      });

      deviceRef.current = device;
      
      device.addEventListener('gattserverdisconnected', onDisconnected);

      console.log('Bağlanılıyor...');
      const server = await device.gatt.connect();
      
      console.log('Servis alınıyor...');
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);
      
      console.log('Karakteristik alınıyor...');
      const characteristic = await service.getCharacteristic(BLE_CHARACTERISTIC_WRITE_UUID);
      
      characteristicRef.current = characteristic;
      setIsBleConnected(true);
      playTone(800, 'sine', 0.1); // Connection sound
      
    } catch (error: any) {
      // Gracefully handle cancellation
      if (
        error.name === 'NotFoundError' || 
        error.message?.includes('cancelled') || 
        error.message?.includes('User cancelled')
      ) {
        console.log('Bluetooth bağlantısı kullanıcı tarafından iptal edildi.');
        return;
      }

      console.error('Bluetooth hatası:', error);
      setBleError("Bağlantı hatası: " + (error.message || "Bilinmeyen hata"));
    }
  };

  const disconnectDevice = () => {
    if (deviceRef.current && deviceRef.current.gatt.connected) {
      deviceRef.current.gatt.disconnect();
    }
  };

  const onDisconnected = () => {
    console.log('Bağlantı koptu.');
    setIsBleConnected(false);
    characteristicRef.current = null;
    playTone(300, 'sawtooth', 0.3); // Disconnect sound
  };

  const sendToDevice = async (data: string) => {
    if (!characteristicRef.current || !isBleConnected) return;

    try {
      const encoder = new TextEncoder();
      await characteristicRef.current.writeValue(encoder.encode(data + '\n'));
      console.log('Gönderildi:', data);
    } catch (error) {
      console.error('Gönderme hatası:', error);
      onDisconnected();
    }
  };

  // --- Bluetooth Logic End ---

  const playTone = (freq: number, type: 'sine' | 'square' | 'triangle' | 'sawtooth' = 'sine', duration: number = 0.1) => {
      initAudio();
      const ctx = audioContextRef.current;
      if(!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + duration);
  };

  const playMelody = () => {
    initAudio();
    const ctx = audioContextRef.current;
    if (!ctx) return;
    const t = ctx.currentTime;
    
    // Ding-Dong
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.frequency.setValueAtTime(600, t);
    osc1.frequency.exponentialRampToValueAtTime(500, t + 0.1); 
    gain1.gain.setValueAtTime(0.1, t);
    gain1.gain.exponentialRampToValueAtTime(0.01, t + 1.2); 
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 1.2);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.frequency.setValueAtTime(400, t + 0.5);
    osc2.frequency.exponentialRampToValueAtTime(350, t + 0.6);
    gain2.gain.setValueAtTime(0.1, t + 0.5);
    gain2.gain.exponentialRampToValueAtTime(0.01, t + 2.0);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t + 0.5);
    osc2.stop(t + 2.0);
  };

  const playUnlockSound = () => {
      playTone(800, 'square', 0.1);
      setTimeout(() => playTone(1200, 'square', 0.2), 100);
  };

  const handleNumPress = (num: string) => {
    playTone(1200, 'sine', 0.08);
    
    // Send to Bluetooth Device
    sendToDevice(`KEY:${num}`);

    if (display === "DAİRE NO GİRİNİZ" || display === "ARANIYOR..." || display === "KAPI AÇIK") {
        setDisplay(num);
        setInput(num);
    } else {
        const newVal = input + num;
        setInput(newVal);
        setDisplay(newVal);
    }
  };

  const handleClear = () => {
      playTone(600, 'triangle', 0.1);
      sendToDevice("CMD:CLEAR");
      setInput("");
      setDisplay("DAİRE NO GİRİNİZ");
  };

  const handleCall = () => {
      if (input.length > 0) {
          playMelody();
          sendToDevice("CMD:CALL"); // Send Call command
          setDisplay("ARANIYOR...");
          setTimeout(() => {
              setDisplay("CEVAP YOK");
              setTimeout(() => {
                  setInput("");
                  setDisplay("DAİRE NO GİRİNİZ");
              }, 2000);
          }, 3000);
      } else {
          setDisplay("DAİRE NO YAZIN");
          setTimeout(() => setDisplay("DAİRE NO GİRİNİZ"), 2000);
      }
  };

  const handleDoor = () => {
      // Always allow door attempt logic, but send command if connected
      sendToDevice("CMD:OPEN"); 
      
      if (input === "1234" || isBleConnected) { // Allow open if BLE connected regardless of code for demo
          playUnlockSound();
          setDisplay("KAPI AÇIK");
          setTimeout(() => {
              setInput("");
              setDisplay("DAİRE NO GİRİNİZ");
          }, 2000);
      } else {
          playTone(400, 'sawtooth', 0.3);
          setDisplay("GİRİŞ YASAK");
          setTimeout(() => {
             setDisplay(input || "DAİRE NO GİRİNİZ");
          }, 1500);
      }
  };

  return (
    <div className="h-full w-full bg-[#cbd5e1] flex flex-col items-center justify-center p-2 md:p-4 relative font-sans overflow-hidden">
      {/* Background Texture */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 z-0"></div>
      
      {/* Bluetooth Connection Button */}
      <button 
        onClick={isBleConnected ? disconnectDevice : connectToDevice}
        className={`absolute top-2 right-2 z-50 p-2 rounded-full shadow-lg border backdrop-blur-md transition-all ${
            isBleConnected 
            ? 'bg-blue-600 border-blue-400 text-white shadow-blue-500/50' 
            : 'bg-gray-200/80 border-gray-400 text-gray-600 hover:bg-gray-300'
        }`}
      >
          {isBleConnected ? <BluetoothConnected className="w-5 h-5" /> : <BluetoothOff className="w-5 h-5" />}
      </button>

      {bleError && (
          <div className="absolute top-16 z-50 bg-red-500/90 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg backdrop-blur animate-pulse">
              {bleError}
          </div>
      )}
      
      {/* Intercom Panel Body - Compacted */}
      <div className="relative z-10 w-full max-w-[320px] bg-gray-200 rounded-3xl shadow-[0_10px_25px_rgba(0,0,0,0.5),inset_0_2px_5px_rgba(255,255,255,0.8)] border-t border-l border-white/50 border-b-8 border-r-8 border-gray-500/30 p-4 flex flex-col gap-3 scale-95 origin-center">
        
        {/* Screw Holes */}
        <div className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full bg-gray-400 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)] flex items-center justify-center">
            <div className="w-full h-[1px] bg-gray-500 rotate-45"></div>
            <div className="w-full h-[1px] bg-gray-500 -rotate-45"></div>
        </div>
        <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-gray-400 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)] flex items-center justify-center">
            <div className="w-full h-[1px] bg-gray-500 rotate-45"></div>
            <div className="w-full h-[1px] bg-gray-500 -rotate-45"></div>
        </div>
        <div className="absolute bottom-3 left-3 w-2.5 h-2.5 rounded-full bg-gray-400 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)] flex items-center justify-center">
            <div className="w-full h-[1px] bg-gray-500 rotate-45"></div>
            <div className="w-full h-[1px] bg-gray-500 -rotate-45"></div>
        </div>
        <div className="absolute bottom-3 right-3 w-2.5 h-2.5 rounded-full bg-gray-400 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)] flex items-center justify-center">
            <div className="w-full h-[1px] bg-gray-500 rotate-45"></div>
            <div className="w-full h-[1px] bg-gray-500 -rotate-45"></div>
        </div>

        {/* LCD Screen - Compacted */}
        <div className="w-full bg-[#1a1a1a] p-1 rounded-lg shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] border-b-2 border-white/10">
            <div className="bg-[#003366] h-16 rounded border-4 border-[#111] relative overflow-hidden flex flex-col items-center justify-center shadow-[inset_0_0_20px_rgba(0,255,255,0.1)]">
                {/* Scanlines */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_4px,3px_100%] pointer-events-none"></div>
                
                {/* BLE Status Indicator on Screen */}
                {isBleConnected && (
                    <div className="absolute top-1 right-1">
                        <Bluetooth className="w-3 h-3 text-blue-400 animate-pulse" />
                    </div>
                )}

                <span className="relative z-10 text-cyan-400 font-mono text-lg tracking-widest font-bold drop-shadow-[0_0_5px_rgba(34,211,238,0.8)] text-center px-2 animate-pulse break-words w-full">
                    {display}
                </span>
                <span className="relative z-10 text-cyan-700/60 text-[9px] mt-0.5 tracking-[0.2em]">
                    AUDIO SYSTEMS {isBleConnected ? '+ BLE' : ''}
                </span>
            </div>
        </div>

        {/* Controls Container */}
        <div className="flex flex-col gap-2.5 px-1">
            
            {/* Top Function Buttons (3 Buttons) */}
            <div className="grid grid-cols-3 gap-3 mb-1">
                <IntercomButton onClick={handleClear} icon={<ArrowLeft size={20}/>} label="" color="blue" />
                <IntercomButton onClick={handleCall} icon={<Bell size={20}/>} label="ZİL" color="blue" />
                <IntercomButton onClick={handleDoor} icon={<ArrowRight size={20}/>} label="" color="blue" />
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <IntercomButton key={num} onClick={() => handleNumPress(num.toString())} label={num.toString()} color="blue" isNum />
                ))}
                
                {/* Bottom Row: *, 0, # */}
                <IntercomButton onClick={() => handleNumPress("*")} label="*" color="blue" isNum />
                <IntercomButton onClick={() => handleNumPress("0")} label="0" color="blue" isNum />
                <IntercomButton onClick={() => handleNumPress("#")} label="#" color="blue" isNum />
            </div>
        </div>

        {/* Removed Speaker Grille */}

      </div>
    </div>
  );
};

interface ButtonProps {
    onClick: () => void;
    label: string;
    icon?: React.ReactNode;
    color: 'blue' | 'gray';
    isNum?: boolean;
}

const IntercomButton: React.FC<ButtonProps> = ({ onClick, label, icon, isNum }) => {
    return (
        <button
            onClick={onClick}
            className={`
                aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5
                relative overflow-hidden transition-all active:scale-95 active:brightness-110
                bg-gradient-to-b from-cyan-500 to-blue-700
                shadow-[0_3px_5px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.2)]
                border border-blue-900
            `}
        >
            {/* Highlight Shine */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none"></div>
            
            {icon && <div className="text-white drop-shadow-md">{icon}</div>}
            
            <span className={`text-white font-bold drop-shadow-md ${isNum ? 'text-xl' : 'text-[9px] tracking-wide'}`}>
                {label}
            </span>
        </button>
    );
};

export default Intercom;