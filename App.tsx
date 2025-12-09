import React, { useState } from 'react';
import { ScanLine, QrCode, Bell } from 'lucide-react';
import Scanner from './components/Scanner';
import Generator from './components/Generator';
import Intercom from './components/Intercom';
import { AppTab } from './types';

export default function App() {
  // Default to SCAN as per requirements
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.SCAN);

  return (
    <div className="h-screen w-full bg-black flex flex-col relative overflow-hidden">
      
      {/* Content Area */}
      <div className="flex-1 relative">
        <div className={`absolute inset-0 transition-transform duration-300 ease-in-out ${activeTab === AppTab.SCAN ? 'translate-x-0' : '-translate-x-full'}`}>
          <Scanner active={activeTab === AppTab.SCAN} />
        </div>
        
        <div className={`absolute inset-0 transition-transform duration-300 ease-in-out ${
            activeTab === AppTab.GENERATE 
            ? 'translate-x-0' 
            : (activeTab === AppTab.SCAN ? 'translate-x-full' : '-translate-x-full')
        }`}>
          <Generator />
        </div>

        <div className={`absolute inset-0 transition-transform duration-300 ease-in-out ${activeTab === AppTab.INTERCOM ? 'translate-x-0' : 'translate-x-full'}`}>
           <Intercom />
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="h-20 bg-neutral-950 border-t border-neutral-800 flex justify-around items-center px-6 z-30 pb-safe">
        <button
          onClick={() => setActiveTab(AppTab.SCAN)}
          className={`flex flex-col items-center gap-1.5 p-2 transition-all duration-200 ${
            activeTab === AppTab.SCAN 
              ? 'text-emerald-400 scale-105' 
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <div className={`p-2 rounded-full ${activeTab === AppTab.SCAN ? 'bg-emerald-400/10' : 'bg-transparent'}`}>
            <ScanLine className="w-6 h-6" />
          </div>
          <span className="text-xs font-medium">Okut</span>
        </button>

        {/* Separator Line */}
        <div className="h-8 w-[1px] bg-neutral-800"></div>

        <button
          onClick={() => setActiveTab(AppTab.GENERATE)}
          className={`flex flex-col items-center gap-1.5 p-2 transition-all duration-200 ${
            activeTab === AppTab.GENERATE 
              ? 'text-indigo-400 scale-105' 
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <div className={`p-2 rounded-full ${activeTab === AppTab.GENERATE ? 'bg-indigo-400/10' : 'bg-transparent'}`}>
            <QrCode className="w-6 h-6" />
          </div>
          <span className="text-xs font-medium">Oluştur</span>
        </button>

        {/* Separator Line */}
        <div className="h-8 w-[1px] bg-neutral-800"></div>

        <button
          onClick={() => setActiveTab(AppTab.INTERCOM)}
          className={`flex flex-col items-center gap-1.5 p-2 transition-all duration-200 ${
            activeTab === AppTab.INTERCOM 
              ? 'text-amber-400 scale-105' 
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <div className={`p-2 rounded-full ${activeTab === AppTab.INTERCOM ? 'bg-amber-400/10' : 'bg-transparent'}`}>
            <Bell className="w-6 h-6" />
          </div>
          <span className="text-xs font-medium">Zil</span>
        </button>
      </div>
    </div>
  );
}