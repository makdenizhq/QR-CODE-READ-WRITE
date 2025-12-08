import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { AlertCircle } from 'lucide-react';
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
  // Offscreen canvas for jsQR processing to avoid reading from main display canvas
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [error, setError] = useState<string | null>(null);
  
  const requestRef = useRef<number>(0);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  
  // Refs for logic loop
  const activeRef = useRef(active);
  const lastScannedRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);

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
    
    // Initialize processing canvas once
    if (!processingCanvasRef.current) {
      processingCanvasRef.current = document.createElement('canvas');
    }
  }, []);

  const drawLensCorners = (ctx: CanvasRenderingContext2D, points: {x: number, y: number}[]) => {
    if (points.length < 4) return;

    const [tl, tr, br, bl] = points;
    // Made smaller and more refined
    const lineWidth = 5; 
    const cornerLen = 20;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = lineWidth;

    // 1. Top-Left (Red)
    ctx.strokeStyle = "#EA4335"; 
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y + cornerLen);
    ctx.lineTo(tl.x, tl.y);
    ctx.lineTo(tl.x + cornerLen, tl.y);
    ctx.stroke();

    // 2. Top-Right (Blue)
    ctx.strokeStyle = "#4285F4";
    ctx.beginPath();
    ctx.moveTo(tr.x - cornerLen, tr.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(tr.x, tr.y + cornerLen);
    ctx.stroke();

    // 3. Bottom-Right (Green)
    ctx.strokeStyle = "#34A853";
    ctx.beginPath();
    ctx.moveTo(br.x, br.y - cornerLen);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(br.x - cornerLen, br.y);
    ctx.stroke();

    // 4. Bottom-Left (Yellow)
    ctx.strokeStyle = "#FBBC04";
    ctx.beginPath();
    ctx.moveTo(bl.x + cornerLen, bl.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.lineTo(bl.x, bl.y - cornerLen);
    ctx.stroke();
  };

  const drawIdleState = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Reduced size to 50% for a smaller, more focused frame
    const size = Math.min(width, height) * 0.5;
    const x = (width - size) / 2;
    const y = (height - size) / 2;
    const len = 25; // Shorter lines for minimal look

    // Pulsing effect
    const time = Date.now() / 1000;
    const alpha = 0.5 + (Math.sin(time * 4) * 0.3); 

    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // TL
    ctx.beginPath(); ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    // TR
    ctx.beginPath(); ctx.moveTo(x + size - len, y); ctx.lineTo(x + size, y); ctx.lineTo(x + size, y + len); ctx.stroke();
    // BR
    ctx.beginPath(); ctx.moveTo(x + size, y + size - len); ctx.lineTo(x + size, y + size); ctx.lineTo(x + size - len, y + size); ctx.stroke();
    // BL
    ctx.beginPath(); ctx.moveTo(x + len, y + size); ctx.lineTo(x, y + size); ctx.lineTo(x, y + size - len); ctx.stroke();
    
    // Optional: Add a subtle center dot
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(width/2, height/2, 2, 0, Math.PI * 2);
    ctx.fill();
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

        // 1. Try Native BarcodeDetector
        if (detectorRef.current) {
          try {
            const barcodes = await detectorRef.current.detect(video);
            if (barcodes.length > 0) {
              foundCode = true;
              rawData = barcodes[0].rawValue;
              points = barcodes[0].cornerPoints;
            }
          } catch (err) {
            // Ignore native errors
          }
        }

        // 2. Fallback to jsQR
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

        // VISUALS & ACTION
        if (foundCode && points.length > 0) {
          drawLensCorners(ctx, points);

          const now = Date.now();
          const isSameCode = rawData === lastScannedRef.current;
          const isCooldownOver = (now - lastScanTimeRef.current) > 2000;

          if (!isSameCode || isCooldownOver) {
             lastScannedRef.current = rawData;
             lastScanTimeRef.current = now;

             if (navigator.vibrate) navigator.vibrate(50);
             const type = detectQRType(rawData);
             performAction(rawData, type);
          }
        } else {
          drawIdleState(ctx, canvas.width, canvas.height);
        }
      }
    }
    
    // Loop
    requestRef.current = requestAnimationFrame(scanFrame);
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let isMounted = true;

    const startCamera = async () => {
      if (!active) return;

      try {
        setError(null);
        // Try environment camera first
        try {
           stream = await navigator.mediaDevices.getUserMedia({ 
             video: { facingMode: "environment", width: { ideal: 1920 } } 
           });
        } catch (firstErr) {
           // Fallback to any camera
           stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        
        if (!isMounted) {
          stream?.getTracks().forEach(t => t.stop());
          return;
        }

        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          
          const onMetadata = async () => {
             if (isMounted && videoRef.current) {
                try {
                  await videoRef.current.play();
                  // Start the loop
                  if (requestRef.current) cancelAnimationFrame(requestRef.current);
                  requestRef.current = requestAnimationFrame(scanFrame);
                } catch (e) {
                  console.error("Play failed", e);
                }
             }
          };

          videoRef.current.onloadedmetadata = onMetadata;
          
          if (videoRef.current.readyState >= 1) {
            onMetadata();
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Camera error", err);
        let msg = "Kameraya erişilemedi.";
        if (err.name === 'NotAllowedError') msg = "Lütfen kamera izni veriniz.";
        setError(msg);
      }
    };

    if (active) {
      startCamera();
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }

    return () => {
      isMounted = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [active, scanFrame]);

  if (!active) return null;

  return (
    <div className="relative h-full w-full bg-black flex flex-col items-center justify-center overflow-hidden">
      {error ? (
        <div className="text-center p-6 bg-neutral-900/90 rounded-xl border border-red-500/30 m-4 max-w-sm backdrop-blur-md relative z-50">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-white font-medium mb-2">Hata</p>
          <p className="text-neutral-400 text-sm">{error}</p>
          <button 
             onClick={() => window.location.reload()}
             className="mt-6 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-white"
          >
            Tekrar Dene
          </button>
        </div>
      ) : (
        <>
          <video 
            ref={videoRef} 
            className="absolute inset-0 w-full h-full object-cover" 
            playsInline 
            muted 
          />
          <canvas 
            ref={canvasRef} 
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        </>
      )}
    </div>
  );
};

export default Scanner;