import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { AlertCircle, RefreshCcw, Zap, ZapOff, Volume2, VolumeX } from 'lucide-react';
import { detectQRType, performAction } from '../utils/qrUtils';

interface ScannerProps {
  active: boolean;
}

// Interface for the native BarcodeDetector API
interface BarcodeDetector {
  detect: (image: ImageBitmapSource) => Promise<Array<{ rawValue: string, cornerPoints: {x: number, y: number}[] }>>;
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): BarcodeDetector;
      getSupportedFormats: () => Promise<string[]>;
    };
  }
}

const Scanner: React.FC<ScannerProps> = ({ active }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  
  // Feedback State
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('qr-muted') === 'true';
  });
  
  const requestRef = useRef<number>(0);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  
  // Refs for logic loop
  const activeRef = useRef(active);
  const lastScannedRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  
  // Smooth tracking refs
  const currentCornersRef = useRef<{x: number, y: number}[] | null>(null);

  useEffect(() => {
    activeRef.current = active;
    if (!active) {
      lastScannedRef.current = null;
      // Turn off torch when leaving tab
      if (torchOn) toggleTorch(false);
    }
  }, [active]);

  // Persist Mute State
  useEffect(() => {
    localStorage.setItem('qr-muted', String(isMuted));
  }, [isMuted]);

  // Initialize Native Barcode Detector
  useEffect(() => {
    const initDetector = async () => {
      if ('BarcodeDetector' in window && window.BarcodeDetector) {
        try {
          const formats = await window.BarcodeDetector.getSupportedFormats();
          if (formats.includes('qr_code')) {
            detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
          }
        } catch (e) {
          console.warn("BarcodeDetector initialization failed", e);
        }
      }
    };
    initDetector();
    
    if (!processingCanvasRef.current) {
      processingCanvasRef.current = document.createElement('canvas');
    }
  }, []);

  const toggleTorch = async (forceState?: boolean) => {
    const video = videoRef.current;
    if (video && video.srcObject) {
      const track = (video.srcObject as MediaStream).getVideoTracks()[0];
      if (track) {
        try {
           const newState = forceState !== undefined ? forceState : !torchOn;
           await track.applyConstraints({
             advanced: [{ torch: newState }]
           } as any);
           setTorchOn(newState);
        } catch (e) {
          console.error("Torch toggle failed", e);
        }
      }
    }
  };

  const playScanSound = () => {
    if (isMuted) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  // Linear Interpolation helper
  const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
  };

  // Check if a point is roughly inside the center scan box
  const isPointInFocusArea = (point: {x: number, y: number}, videoWidth: number, videoHeight: number) => {
    const marginX = videoWidth * 0.20; 
    const marginY = videoHeight * 0.20;
    
    return (
      point.x > marginX && 
      point.x < (videoWidth - marginX) &&
      point.y > marginY &&
      point.y < (videoHeight - marginY)
    );
  };

  const drawLensCorners = (ctx: CanvasRenderingContext2D, points: {x: number, y: number}[]) => {
    if (points.length < 4) return;

    // Smooth Tracking
    if (!currentCornersRef.current) {
      currentCornersRef.current = points;
    } else {
      currentCornersRef.current = currentCornersRef.current.map((p, i) => ({
        x: lerp(p.x, points[i].x, 0.4), 
        y: lerp(p.y, points[i].y, 0.4)
      }));
    }

    const [tl, tr, br, bl] = currentCornersRef.current;
    
    const cornerLen = 40;
    const lineWidth = 8;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 10;

    // Google Colors
    ctx.strokeStyle = "#EA4335"; 
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y + cornerLen);
    ctx.lineTo(tl.x, tl.y);
    ctx.lineTo(tl.x + cornerLen, tl.y);
    ctx.stroke();

    ctx.strokeStyle = "#4285F4";
    ctx.beginPath();
    ctx.moveTo(tr.x - cornerLen, tr.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(tr.x, tr.y + cornerLen);
    ctx.stroke();

    ctx.strokeStyle = "#34A853";
    ctx.beginPath();
    ctx.moveTo(br.x, br.y - cornerLen);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(br.x - cornerLen, br.y);
    ctx.stroke();

    ctx.strokeStyle = "#FBBC04";
    ctx.beginPath();
    ctx.moveTo(bl.x + cornerLen, bl.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.lineTo(bl.x, bl.y - cornerLen);
    ctx.stroke();
    
    ctx.shadowColor = "transparent";
  };
  
  const scanFrame = useCallback(async () => {
    if (!activeRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const pCanvas = processingCanvasRef.current;

    if (video && canvas && video.readyState >= 2) { 
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let foundCode = false;
        let points: {x: number, y: number}[] = [];
        let rawData = "";

        // 1. Native BarcodeDetector
        if (detectorRef.current) {
          try {
            const barcodes = await detectorRef.current.detect(video);
            if (barcodes.length > 0) {
              const code = barcodes[0];
              const center = {
                x: (code.cornerPoints[0].x + code.cornerPoints[2].x) / 2,
                y: (code.cornerPoints[0].y + code.cornerPoints[2].y) / 2
              };
              
              if (isPointInFocusArea(center, video.videoWidth, video.videoHeight)) {
                foundCode = true;
                rawData = code.rawValue;
                points = code.cornerPoints;
              }
            }
          } catch (err) {}
        }

        // 2. Fallback jsQR
        if (!foundCode && pCanvas) {
           if (pCanvas.width !== video.videoWidth || pCanvas.height !== video.videoHeight) {
             pCanvas.width = video.videoWidth;
             pCanvas.height = video.videoHeight;
           }
           const pCtx = pCanvas.getContext('2d', { willReadFrequently: true });
           if (pCtx) {
             pCtx.drawImage(video, 0, 0, pCanvas.width, pCanvas.height);
             const imageData = pCtx.getImageData(0, 0, pCanvas.width, pCanvas.height);
             const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
             
             if (code && code.data) {
               const center = {
                 x: (code.location.topLeftCorner.x + code.location.bottomRightCorner.x) / 2,
                 y: (code.location.topLeftCorner.y + code.location.bottomRightCorner.y) / 2
               };

               if (isPointInFocusArea(center, video.videoWidth, video.videoHeight)) {
                 foundCode = true;
                 rawData = code.data;
                 points = [
                   code.location.topLeftCorner,
                   code.location.topRightCorner,
                   code.location.bottomRightCorner,
                   code.location.bottomLeftCorner
                 ];
               }
             }
           }
        }

        if (foundCode && points.length > 0) {
          drawLensCorners(ctx, points);

          const now = Date.now();
          const isSameCode = rawData === lastScannedRef.current;
          const isCooldownOver = (now - lastScanTimeRef.current) > 2000;

          if (!isSameCode || isCooldownOver) {
             lastScannedRef.current = rawData;
             lastScanTimeRef.current = now;
             
             // FEEDBACK: Sound & Vibration
             if (!isMuted) {
                if (navigator.vibrate) navigator.vibrate([50, 50, 50]); // Distinct pattern
                playScanSound();
             }
             
             performAction(rawData, detectQRType(rawData));
          }
        } else {
          currentCornersRef.current = null;
        }
      }
    }
    
    requestRef.current = requestAnimationFrame(scanFrame);
  }, [isMuted]); // Re-create loop if mute setting changes to capture new state

  useEffect(() => {
    let stream: MediaStream | null = null;
    let isMounted = true;

    const startCamera = async () => {
      if (!active) return;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
         setError("Kamera desteklenmiyor (HTTPS gerekli).");
         return;
      }

      try {
        setError(null);
        const constraints = { 
            video: { 
                facingMode: "environment", 
                width: { ideal: 1920 },
                height: { ideal: 1080 } 
            },
            audio: false
        };

        try {
           stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (firstErr: any) {
           console.warn("Falling back to default camera");
           stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        
        if (!isMounted) {
          stream?.getTracks().forEach(t => t.stop());
          return;
        }

        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          
          const track = stream.getVideoTracks()[0];
          const capabilities = track.getCapabilities ? track.getCapabilities() : {};
          if ('torch' in capabilities) {
            setHasTorch(true);
          } else {
            setHasTorch(false);
          }

          const onMetadata = async () => {
             if (isMounted && videoRef.current) {
                try {
                  await videoRef.current.play();
                  if (requestRef.current) cancelAnimationFrame(requestRef.current);
                  requestRef.current = requestAnimationFrame(scanFrame);
                } catch (e) {
                  console.error("Play failed", e);
                }
             }
          };

          videoRef.current.onloadedmetadata = onMetadata;
          if (videoRef.current.readyState >= 1) onMetadata();
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError("Kamera başlatılamadı. İzinleri kontrol edin.");
      }
    };

    if (active) {
      startCamera();
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      setHasTorch(false);
      setTorchOn(false);
    }

    return () => {
      isMounted = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (stream) {
          const track = stream.getVideoTracks()[0];
          if (track) track.stop();
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [active, scanFrame]);

  if (!active) return null;

  return (
    <div className="relative h-full w-full bg-black flex flex-col items-center justify-center overflow-hidden">
      {error ? (
        <div className="text-center p-6 bg-neutral-900/90 rounded-xl border border-red-500/30 m-4 max-w-sm backdrop-blur-md relative z-50">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-white mb-6">{error}</p>
          <button 
             onClick={() => window.location.reload()}
             className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-neutral-800 rounded-lg text-white"
          >
            <RefreshCcw className="w-4 h-4" />
            <span>Yenile</span>
          </button>
        </div>
      ) : (
        <>
          {/* Video & Tracking Layer - Scaled X for Mirror Effect */}
          <div className="absolute inset-0 w-full h-full transform scale-x-[-1]">
             <video 
              ref={videoRef} 
              className="absolute inset-0 w-full h-full object-cover" 
              playsInline 
              muted 
            />
            <canvas 
              ref={canvasRef} 
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>

          {/* Blur Overlay & Static Frame Layer */}
          <div className="absolute inset-0 z-10 pointer-events-none">
             {/* Darkened Blur Overlay using SVG Mask */}
             <div className="absolute inset-0 w-full h-full">
                <svg width="100%" height="100%" className="absolute inset-0">
                  <defs>
                    <mask id="scan-mask">
                      <rect width="100%" height="100%" fill="white" />
                      {/* The Hole */}
                      <rect x="50%" y="50%" width="280" height="280" transform="translate(-140, -140)" fill="black" rx="20" />
                    </mask>
                  </defs>
                  {/* The dark blurred layer */}
                  <rect 
                    width="100%" 
                    height="100%" 
                    fill="rgba(0,0,0,0.6)" 
                    mask="url(#scan-mask)" 
                    style={{ backdropFilter: 'blur(4px)' }} 
                  />
                </svg>
             </div>

             {/* Static Google Colors Frame (Idle State) */}
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[280px] h-[280px] relative opacity-50">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#EA4335] rounded-tl-xl"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#4285F4] rounded-tr-xl"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#34A853] rounded-br-xl"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#FBBC04] rounded-bl-xl"></div>
                </div>
             </div>
          </div>
          
          {/* Top Controls Container */}
          <div className="absolute top-8 left-0 right-0 px-6 flex justify-between z-50 pointer-events-none">
             {/* Sound Toggle - Left */}
             <button
               onClick={() => setIsMuted(!isMuted)}
               className={`p-3 rounded-full backdrop-blur-md transition-all shadow-xl border pointer-events-auto ${
                 isMuted 
                   ? 'bg-black/50 text-white/70 border-white/10' 
                   : 'bg-white text-black border-white shadow-white/20'
               }`}
             >
               {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
             </button>

             {/* Torch Button - Right */}
             {hasTorch && (
                <button
                  onClick={() => toggleTorch()}
                  className={`p-3 rounded-full backdrop-blur-md transition-all shadow-xl border pointer-events-auto ${
                    torchOn 
                      ? 'bg-yellow-400 text-black border-yellow-300 shadow-yellow-400/50' 
                      : 'bg-black/50 text-white border-white/10 hover:bg-black/70'
                  }`}
                >
                  {torchOn ? <ZapOff className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
                </button>
             )}
          </div>
        </>
      )}
    </div>
  );
};

export default Scanner;