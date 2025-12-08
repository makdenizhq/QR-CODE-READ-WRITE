import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { RefreshCw, AlertCircle, Zap } from 'lucide-react';
import { detectQRType, performAction } from '../utils/qrUtils';

interface ScannerProps {
  active: boolean;
}

const Scanner: React.FC<ScannerProps> = ({ active }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const requestRef = useRef<number>(0);
  
  // Refs to access latest state inside the animation frame loop without re-triggering effects
  const activeRef = useRef(active);
  const scannedDataRef = useRef(scannedData);
  const isProcessingRef = useRef(isProcessing);

  useEffect(() => {
    activeRef.current = active;
    scannedDataRef.current = scannedData;
    isProcessingRef.current = isProcessing;
  }, [active, scannedData, isProcessing]);
  
  const scanFrame = useCallback(() => {
    // If scanning is disabled, already scanned, or processing, skip
    if (!activeRef.current || scannedDataRef.current || isProcessingRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        try {
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code && code.data && code.data.trim() !== "") {
            handleScan(code.data);
            return; // Exit loop after successful scan
          }
        } catch (e) {
          console.error("QR processing error", e);
        }
      }
    }
    
    // Continue scanning loop
    requestRef.current = requestAnimationFrame(scanFrame);
  }, []); // Dependencies are empty because we use refs

  const handleScan = (data: string) => {
    setScannedData(data);
    setIsProcessing(true);
    
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(200);

    const type = detectQRType(data);
    
    // Visual delay to show user something happened before redirection
    setTimeout(() => {
      performAction(data, type);
      setIsProcessing(false);
    }, 800);
  };

  const resetScan = () => {
    setScannedData(null);
    setIsProcessing(false);
    // Restart scanning loop
    requestRef.current = requestAnimationFrame(scanFrame);
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let isMounted = true;

    const startCamera = async () => {
      // Don't start if not active or if we already have data
      if (!active || scannedData) return;

      try {
        setError(null);
        
        // Attempt 1: Try environment camera (rear) with ideal resolution
        let constraints: MediaStreamConstraints = { 
          video: { 
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        };

        try {
           stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
           console.warn("Preferred camera failed, attempting fallback...", e);
           // Attempt 2: Fallback to any available video source
           stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        
        // Check if component is still mounted after async operation
        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Ensure video plays inside HTML5 environment (required for iPhone)
          videoRef.current.setAttribute("playsinline", "true"); 
          
          // Wait for metadata to load to ensure dimensions are correct
          videoRef.current.onloadedmetadata = () => {
             if (isMounted && videoRef.current) {
                videoRef.current.play()
                  .then(() => {
                    // Start the scan loop only after video is playing
                    requestRef.current = requestAnimationFrame(scanFrame);
                  })
                  .catch(e => {
                    console.error("Video play error:", e);
                    setError("Video akışı başlatılamadı.");
                  });
             }
          };
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Camera Fatal Error:", err);
        
        let msg = "Kameraya erişilemedi.";
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
             msg = "Kamera izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.";
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
             msg = "Kamera cihazı bulunamadı.";
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
             msg = "Kamera başlatılamadı. Başka bir uygulama kamerayı kullanıyor olabilir.";
        } else if (err.name === 'OverconstrainedError') {
             msg = "İstenilen kamera özellikleri bu cihazda bulunamadı.";
        }
        
        setError(`${msg}`);
      }
    };

    if (active && !scannedData) {
      startCamera();
    } else {
      // If inactive, ensure scanning stops
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }

    // Cleanup function
    return () => {
      isMounted = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [active, scannedData, scanFrame]);

  if (!active) return null;

  return (
    <div className="relative h-full w-full bg-black flex flex-col items-center justify-center overflow-hidden">
      {error ? (
        <div className="text-center p-6 bg-neutral-900/90 rounded-xl border border-red-500/30 m-4 max-w-sm backdrop-blur-md animate-in fade-in zoom-in duration-300">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-white font-medium mb-2">Hata Oluştu</p>
          <p className="text-neutral-400 text-sm">{error}</p>
          <button 
             onClick={() => window.location.reload()}
             className="mt-6 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-white transition-colors"
          >
            Sayfayı Yenile
          </button>
        </div>
      ) : (
        <>
          {/* Video Feed */}
          <video 
            ref={videoRef} 
            className="absolute inset-0 w-full h-full object-cover" 
            playsInline 
            muted 
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Overlay UI */}
          <div className="absolute inset-0 bg-black/30 z-10 flex flex-col items-center justify-center pointer-events-none">
            
            {!scannedData && (
              <div className="relative w-64 h-64 border-2 border-white/50 rounded-3xl overflow-hidden shadow-2xl">
                 <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg"></div>
                 <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg"></div>
                 <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg"></div>
                 <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-emerald-500 rounded-br-lg"></div>
                 
                 {/* Scanning Animation Line */}
                 <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-emerald-500/0 via-emerald-500/20 to-emerald-500/60 animate-[scan_2s_ease-in-out_infinite] border-b-2 border-emerald-400"></div>
              </div>
            )}

            {scannedData && (
              <div className="pointer-events-auto bg-neutral-900/95 backdrop-blur-xl p-8 rounded-3xl text-center border border-white/10 max-w-xs mx-4 shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="mb-4 bg-emerald-500/20 p-4 rounded-full inline-block ring-1 ring-emerald-500/50">
                   <Zap className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Başarılı!</h3>
                <p className="text-sm text-neutral-400 mb-6 break-all line-clamp-4 bg-black/30 p-2 rounded-lg font-mono">
                  {scannedData}
                </p>
                <div className="flex gap-2 justify-center">
                  <button 
                    onClick={resetScan}
                    className="flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-neutral-200 rounded-xl transition-colors font-bold shadow-lg shadow-white/10"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Tekrar Tara
                  </button>
                </div>
              </div>
            )}

            {!scannedData && (
              <div className="absolute bottom-24 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/10">
                <p className="text-white/90 text-sm font-medium tracking-wide">
                  QR Kodu çerçeveye hizalayın
                </p>
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Required for Tailwind custom animation */}
      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(200%); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default Scanner;