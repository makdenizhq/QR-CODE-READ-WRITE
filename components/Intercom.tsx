import React, { useState, useRef, useEffect } from 'react';
import { Bell, ArrowLeft, ArrowRight } from 'lucide-react';

const Intercom: React.FC = () => {
  const [display, setDisplay] = useState("DAİRE NO GİRİNİZ");
  const [input, setInput] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);

  const initAudio = () => {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

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
      setInput("");
      setDisplay("DAİRE NO GİRİNİZ");
  };

  const handleCall = () => {
      if (input.length > 0) {
          playMelody();
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
      if (input === "1234") { // Secret code simulation
          playUnlockSound();
          setDisplay("ŞİFRE KABUL");
          setTimeout(() => {
              setDisplay("KAPI AÇIK");
              setTimeout(() => {
                  setInput("");
                  setDisplay("DAİRE NO GİRİNİZ");
              }, 2000);
          }, 1500);
      } else {
          playTone(400, 'sawtooth', 0.3);
          setDisplay("GİRİŞ YASAK");
          setTimeout(() => {
             setDisplay(input || "DAİRE NO GİRİNİZ");
          }, 1500);
      }
  };

  return (
    <div className="h-full w-full bg-[#cbd5e1] flex flex-col items-center justify-center p-6 relative font-sans overflow-hidden">
      {/* Background Texture */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 z-0"></div>
      
      {/* Intercom Panel Body */}
      <div className="relative z-10 w-full max-w-sm bg-gray-200 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_2px_5px_rgba(255,255,255,0.8)] border-t border-l border-white/50 border-b-8 border-r-8 border-gray-500/30 p-6 flex flex-col gap-6">
        
        {/* Screw Holes */}
        <div className="absolute top-4 left-4 w-3 h-3 rounded-full bg-gray-400 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)] flex items-center justify-center">
            <div className="w-full h-[1px] bg-gray-500 rotate-45"></div>
            <div className="w-full h-[1px] bg-gray-500 -rotate-45"></div>
        </div>
        <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-gray-400 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)] flex items-center justify-center">
            <div className="w-full h-[1px] bg-gray-500 rotate-45"></div>
            <div className="w-full h-[1px] bg-gray-500 -rotate-45"></div>
        </div>
        <div className="absolute bottom-4 left-4 w-3 h-3 rounded-full bg-gray-400 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)] flex items-center justify-center">
            <div className="w-full h-[1px] bg-gray-500 rotate-45"></div>
            <div className="w-full h-[1px] bg-gray-500 -rotate-45"></div>
        </div>
        <div className="absolute bottom-4 right-4 w-3 h-3 rounded-full bg-gray-400 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)] flex items-center justify-center">
            <div className="w-full h-[1px] bg-gray-500 rotate-45"></div>
            <div className="w-full h-[1px] bg-gray-500 -rotate-45"></div>
        </div>

        {/* LCD Screen */}
        <div className="w-full bg-[#1a1a1a] p-1 rounded-lg shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] border-b-2 border-white/10">
            <div className="bg-[#003366] h-24 rounded border-4 border-[#111] relative overflow-hidden flex flex-col items-center justify-center shadow-[inset_0_0_20px_rgba(0,255,255,0.1)]">
                {/* Scanlines */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_4px,3px_100%] pointer-events-none"></div>
                
                <span className="relative z-10 text-cyan-400 font-mono text-xl tracking-widest font-bold drop-shadow-[0_0_5px_rgba(34,211,238,0.8)] text-center px-2 animate-pulse break-words w-full">
                    {display}
                </span>
                <span className="relative z-10 text-cyan-700/60 text-[10px] mt-1 tracking-[0.3em]">
                    AUDIO SYSTEMS
                </span>
            </div>
        </div>

        {/* Controls Container */}
        <div className="flex flex-col gap-4 px-2">
            
            {/* Top Function Buttons (3 Buttons) */}
            <div className="grid grid-cols-3 gap-4 mb-2">
                <IntercomButton onClick={handleClear} icon={<ArrowLeft size={24}/>} label="" color="blue" />
                <IntercomButton onClick={handleCall} icon={<Bell size={24}/>} label="ZİL" color="blue" />
                <IntercomButton onClick={handleDoor} icon={<ArrowRight size={24}/>} label="" color="blue" />
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <IntercomButton key={num} onClick={() => handleNumPress(num.toString())} label={num.toString()} color="blue" isNum />
                ))}
                
                {/* Bottom Row: *, 0, # */}
                <IntercomButton onClick={() => handleNumPress("*")} label="*" color="blue" isNum />
                <IntercomButton onClick={() => handleNumPress("0")} label="0" color="blue" isNum />
                <IntercomButton onClick={() => handleNumPress("#")} label="#" color="blue" isNum />
            </div>
        </div>

        {/* Speaker Grille */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1 opacity-40">
            {[...Array(6)].map((_, i) => (
                <div key={i} className="w-1 h-8 rounded-full bg-black shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]"></div>
            ))}
        </div>

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
                aspect-square rounded-lg flex flex-col items-center justify-center gap-1
                relative overflow-hidden transition-all active:scale-95 active:brightness-110
                bg-gradient-to-b from-cyan-500 to-blue-700
                shadow-[0_4px_6px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-2px_5px_rgba(0,0,0,0.2)]
                border border-blue-900
            `}
        >
            {/* Highlight Shine */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none"></div>
            
            {icon && <div className="text-white drop-shadow-md">{icon}</div>}
            
            <span className={`text-white font-bold drop-shadow-md ${isNum ? 'text-2xl' : 'text-[10px] tracking-wide'}`}>
                {label}
            </span>
        </button>
    );
};

export default Intercom;