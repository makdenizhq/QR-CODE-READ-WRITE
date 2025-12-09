import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { AlertCircle, RefreshCcw, Zap, ZapOff } from 'lucide-react';
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
    }
  }, [active]);

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

  const toggleTorch = async () => {
    const video = videoRef.current;
    if (video && video.srcObject) {
      const track = (video.srcObject as MediaStream).getVideoTracks()[0];
      if (track) {
        try {
           await track.applyConstraints({
             advanced: [{ torch: !torchOn }]
           } as any);
           setTorchOn(!torchOn);
        } catch (e) {
          console.error("Torch toggle failed", e);
        }
      }
    }
  };

  // Linear Interpolation helper
  const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
  };

  const drawLensCorners = (ctx: CanvasRenderingContext2D, points: {x: number, y: number}[]) => {
    if (points.length < 4) return;

    // Use a factor of 0.3 for smooth but responsive tracking
    // If currentCornersRef is null, snap immediately.
    if (!currentCornersRef.current) {
      currentCornersRef.current = points;
    } else {
      currentCornersRef.current = currentCornersRef.current.map((p, i) => ({
        x: lerp(p.x, points[i].x, 0.3),
        y: lerp(p.y, points[i].y, 0.3)
      }));
    }

    const [tl, tr, br, bl] = currentCornersRef.current;
    
    // Google Lens Style Dimensions
    const cornerLen = 30;
    const lineWidth = 6;
    const cornerRadius = 6; // For rounded joins

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = lineWidth;
    
    // Add a subtle shadow/glow for better visibility
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    // 1. Top-Left (Google Red)
    ctx.strokeStyle = "#EA4335"; 
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y + cornerLen);
    ctx.lineTo(tl.x, tl.y);
    ctx.lineTo(tl.x + cornerLen, tl.y);
    ctx.stroke();

    // 2. Top-Right (Google Blue)
    ctx.strokeStyle = "#4285F4";
    ctx.beginPath();
    ctx.moveTo(tr.x - cornerLen, tr.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(tr.x, tr.y + cornerLen);
    ctx.stroke();

    // 3. Bottom-Right (Google Green)
    ctx.strokeStyle = "#34A853";
    ctx.beginPath();
    ctx.moveTo(br.x, br.y - cornerLen);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(br.x - cornerLen, br.y);
    ctx.stroke();

    // 4. Bottom-Left (Google Yellow)
    ctx.strokeStyle = "#FBBC04";
    ctx.beginPath();
    ctx.moveTo(bl.x + cornerLen, bl.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.lineTo(bl.x, bl.y - cornerLen);
    ctx.stroke();
    
    // Reset shadow
    ctx.shadowColor = "transparent";
  };

  const drawIdleState = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Reset smoothed corners so next find snaps instantly
    currentCornersRef.current = null;

    const size = Math.min(width, height) * 0.55;
    const x = (width - size) / 2;
    const y = (height - size) / 2;
    const len = 30;

    // Breathing animation
    const time = Date.now() / 1000;
    const alpha = 0.6 + (Math.sin(time * 3) * 0.2); 

    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    // White bracket frame
    // TL
    ctx.beginPath(); ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    // TR
    ctx.beginPath(); ctx.moveTo(x + size - len, y); ctx.lineTo(x + size, y); ctx.lineTo(x + size, y + len); ctx.stroke();
    // BR
    ctx.beginPath(); ctx.moveTo(x + size, y + size - len); ctx.lineTo(x + size, y + size); ctx.lineTo(x + size - len, y + size); ctx.stroke();
    // BL
    ctx.beginPath(); ctx.moveTo(x + len, y + size); ctx.lineTo(x, y + size); ctx.lineTo(x, y + size - len); ctx.stroke();
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
              foundCode = true;
              rawData = barcodes[0].rawValue;
              points = barcodes[0].cornerPoints;
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

        if (foundCode && points.length > 0) {
          drawLensCorners(ctx, points);

          const now = Date.now();
          const isSameCode = rawData === lastScannedRef.current;
          const isCooldownOver = (now - lastScanTimeRef.current) > 2000;

          if (!isSameCode || isCooldownOver) {
             lastScannedRef.current = rawData;
             lastScanTimeRef.current = now;
             if (navigator.vibrate) navigator.vibrate(50);
             performAction(rawData, detectQRType(rawData));
          }
        } else {
          drawIdleState(ctx, canvas.width, canvas.height);
        }
      }
    }
    
    requestRef.current = requestAnimationFrame(scanFrame);
  }, []);

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
        // Default to environment (rear) camera
        // Note: We generally don't mirror rear cameras as it makes aiming difficult
        const constraints = { 
            video: { 
                facingMode: "environment", 
                width: { ideal: 1920 }, // Request higher res for clarity
                height: { ideal: 1080 } 
            },
            audio: false
        };

        try {
           stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (firstErr: any) {
           if (firstErr.name === 'NotAllowedError' || firstErr.name === 'PermissionDeniedError') {
             throw firstErr;
           }
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
          
          // Check for torch capability
          const track = stream.getVideoTracks()[0];
          const capabilities = track.getCapabilities ? track.getCapabilities() : {};
          if ('torch' in capabilities) {
            setHasTorch(true);
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
        setError("Kamera başlatılamadı veya izin verilmedi.");
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
          // Turn off torch before stopping
          const track = stream.getVideoTracks()[0];
          if (track) {
              track.applyConstraints({ advanced: [{ torch: false }] } as any).catch(() => {});
          }
          stream.getTracks().forEach(t => t.stop());
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
          <video 
            ref={videoRef} 
            className="absolute inset-0 w-full h-full object-cover" 
            // Note: Standard rear-camera behavior is NOT mirrored. 
            // If the user flips to front camera (not implemented here but possible), we would apply scale-x-[-1]
            style={{ transform: 'none' }}
            playsInline 
            muted 
          />
          <canvas 
            ref={canvasRef} 
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
          
          {/* Torch Button */}
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`absolute top-6 right-6 p-4 rounded-full backdrop-blur-md transition-all z-20 shadow-lg ${
                torchOn 
                  ? 'bg-yellow-400/90 text-black shadow-yellow-400/50' 
                  : 'bg-black/40 text-white hover:bg-black/60'
              }`}
            >
              {torchOn ? <ZapOff className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default Scanner;