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
      
      // Request portrait orientation (9:16 aspect ratio for Instagram Stories)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Prefer back camera
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 9/16 },
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
      
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      
      // Force portrait orientation (9:16 aspect ratio)
      // If the video is landscape, we'll crop to portrait
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = videoWidth;
      let sourceHeight = videoHeight;
      
      const isLandscape = videoWidth > videoHeight;
      
      if (isLandscape) {
        // Crop from center to get portrait
        const targetRatio = 9 / 16;
        const newWidth = videoHeight * targetRatio;
        sourceX = (videoWidth - newWidth) / 2;
        sourceWidth = newWidth;
      }
      
      // Set canvas to portrait dimensions (1080x1920 or proportional)
      const outputWidth = 1080;
      const outputHeight = 1920;
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      
      // Draw current video frame to canvas with portrait orientation
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Erro ao capturar imagem');
        return null;
      }
      
      // Draw and scale to fill the portrait canvas
      ctx.drawImage(
        video, 
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, outputWidth, outputHeight
      );
      
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
  // Forces portrait orientation (9:16 aspect ratio) for Instagram Stories
  const captureFromFile = useCallback(async (file: File): Promise<Blob | null> => {
    if (!file.type.startsWith('image/')) {
      setError('Arquivo deve ser uma imagem');
      return null;
    }

    try {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          
          // Target portrait dimensions (9:16 aspect ratio for Stories)
          const outputWidth = 1080;
          const outputHeight = 1920;
          const targetRatio = outputWidth / outputHeight; // 0.5625
          
          canvas.width = outputWidth;
          canvas.height = outputHeight;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setError('Erro ao processar imagem');
            resolve(null);
            return;
          }
          
          const imgRatio = img.width / img.height;
          
          let sourceX = 0;
          let sourceY = 0;
          let sourceWidth = img.width;
          let sourceHeight = img.height;
          
          if (imgRatio > targetRatio) {
            // Image is wider - crop sides
            sourceWidth = img.height * targetRatio;
            sourceX = (img.width - sourceWidth) / 2;
          } else {
            // Image is taller - crop top/bottom
            sourceHeight = img.width / targetRatio;
            sourceY = (img.height - sourceHeight) / 2;
          }
          
          // Draw cropped and scaled to portrait canvas
          ctx.drawImage(
            img,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, outputWidth, outputHeight
          );
          
          canvas.toBlob(
            (blob) => resolve(blob),
            'image/jpeg',
            0.85
          );
          
          // Cleanup
          URL.revokeObjectURL(img.src);
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
