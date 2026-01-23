import { useState, useRef, useCallback } from 'react';

interface UseCameraReturn {
  isSupported: boolean;
  isCapturing: boolean;
  error: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  startCamera: () => Promise<boolean>;
  stopCamera: () => void;
  takePhoto: () => Promise<Blob | null>;
  captureFromFile: (file: File) => Promise<Blob | null>;
}

export function useCamera(): UseCameraReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Check if camera is supported
  const isSupported = typeof navigator !== 'undefined' && 
    'mediaDevices' in navigator && 
    'getUserMedia' in navigator.mediaDevices;

  const startCamera = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Câmera não suportada neste dispositivo');
      return false;
    }

    try {
      setError(null);
      setIsCapturing(true);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Prefer back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      return true;
    } catch (err) {
      let errorMessage = 'Erro ao acessar câmera';
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = 'Permissão de câmera negada';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMessage = 'Nenhuma câmera encontrada';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMessage = 'Câmera em uso por outro aplicativo';
        }
      }
      
      setError(errorMessage);
      setIsCapturing(false);
      return false;
    }
  }, [isSupported]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsCapturing(false);
  }, []);

  const takePhoto = useCallback(async (): Promise<Blob | null> => {
    if (!videoRef.current || !canvasRef.current) {
      setError('Elementos de vídeo não disponíveis');
      return null;
    }

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw current video frame to canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Erro ao capturar imagem');
        return null;
      }
      
      ctx.drawImage(video, 0, 0);
      
      // Convert canvas to blob
      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => {
            resolve(blob);
          },
          'image/jpeg',
          0.85 // Quality
        );
      });
    } catch (err) {
      setError('Erro ao tirar foto');
      return null;
    }
  }, []);

  // Fallback: capture from file input (for devices without camera API)
  const captureFromFile = useCallback(async (file: File): Promise<Blob | null> => {
    if (!file.type.startsWith('image/')) {
      setError('Arquivo deve ser uma imagem');
      return null;
    }

    try {
      // Compress/resize if needed
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSize = 1920;
          
          let { width, height } = img;
          
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => resolve(blob),
            'image/jpeg',
            0.85
          );
        };
        
        img.onerror = () => {
          setError('Erro ao processar imagem');
          resolve(null);
        };
        
        img.src = URL.createObjectURL(file);
      });
    } catch (err) {
      setError('Erro ao processar arquivo');
      return null;
    }
  }, []);

  return {
    isSupported,
    isCapturing,
    error,
    videoRef,
    canvasRef,
    startCamera,
    stopCamera,
    takePhoto,
    captureFromFile,
  };
}
