import { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCamera } from '@/hooks/useCamera';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Camera, MapPin, Check, X, RotateCcw, Upload, Loader2, AlertCircle } from 'lucide-react';

export type CaptureMode = 'start' | 'finish';

const MODE = {
  start: { title: 'Iniciar Atendimento', verb: 'Iniciar', help: 'Registre uma foto do início (opcional).' },
  finish: { title: 'Finalizar Atendimento', verb: 'Finalizar', help: 'Registre uma foto do serviço realizado (opcional).' },
} as const;

interface PhotoCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: CaptureMode;
  producerName?: string;
  demandName?: string;
  /** Recebe a foto (se houver) e as coordenadas (se houver). Não fala com o servidor. */
  onConfirm: (data: { photoBlob: Blob | null; latitude: number | null; longitude: number | null }) => void;
}

export function PhotoCaptureModal({
  open, onOpenChange, mode, producerName, demandName, onConfirm,
}: PhotoCaptureModalProps) {
  const cfg = MODE[mode];
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isSupported: cameraSupported, isCapturing, error: cameraError,
    videoRef, canvasRef, startCamera, stopCamera, takePhoto, captureFromFile,
  } = useCamera();
  const { getCurrentPosition, isLoading: gpsLoading } = useGeolocation();

  useEffect(() => {
    if (open) {
      setPhotoBlob(null); setPhotoPreview(null); setCoords(null); setShowCamera(false); setPermDenied(false);
    } else {
      stopCamera();
    }
  }, [open, stopCamera]);

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const handleStartCamera = async () => {
    setPermDenied(false);
    if ('permissions' in navigator) {
      try {
        const perm = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (perm.state === 'denied') { setPermDenied(true); return; }
      } catch { /* sem Permissions API */ }
    }
    setShowCamera(true);
    const ok = await startCamera();
    if (!ok) { setShowCamera(false); setPermDenied(true); }
  };

  const handleTakePhoto = async () => {
    const blob = await takePhoto();
    if (blob) { setPhotoBlob(blob); setPhotoPreview(URL.createObjectURL(blob)); stopCamera(); setShowCamera(false); }
  };
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const blob = await captureFromFile(file); if (blob) { setPhotoBlob(blob); setPhotoPreview(URL.createObjectURL(blob)); } }
  };
  const handleRetake = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoBlob(null); setPhotoPreview(null);
  };
  const handleGps = async () => {
    try { setCoords(await getCurrentPosition()); } catch { /* erro tratado no hook */ }
  };
  const handleConfirm = () => {
    onConfirm({ photoBlob, latitude: coords?.latitude ?? null, longitude: coords?.longitude ?? null });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) stopCamera(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{cfg.title}</DialogTitle>
          <DialogDescription>{producerName}{demandName ? ` — ${demandName}` : ''}</DialogDescription>
        </DialogHeader>

        {showCamera ? (
          <div className="space-y-4">
            <div className="relative aspect-[9/16] max-h-[60vh] bg-black rounded-lg overflow-hidden mx-auto">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              {!isCapturing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}
            </div>
            {cameraError && <p className="text-sm text-destructive text-center">{cameraError}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { stopCamera(); setShowCamera(false); }} className="flex-1">
                <X className="h-4 w-4 mr-2" /> Cancelar
              </Button>
              <Button onClick={handleTakePhoto} disabled={!isCapturing} className="flex-1">
                <Camera className="h-4 w-4 mr-2" /> Tirar Foto
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{cfg.help}</p>

            {/* Foto (opcional) */}
            {photoPreview ? (
              <div className="relative w-full aspect-[9/16] max-h-[45vh] rounded-lg overflow-hidden border mx-auto">
                <img src={photoPreview} alt="Foto" className="w-full h-full object-cover" />
                <Button size="icon" variant="secondary" onClick={handleRetake} className="absolute top-2 right-2">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                {permDenied && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    Câmera negada. Use a galeria ou libere nas configurações do navegador.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {cameraSupported && !permDenied && (
                    <Button variant="outline" onClick={handleStartCamera}>
                      <Camera className="h-4 w-4 mr-2" /> Câmera
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} className={cameraSupported && !permDenied ? '' : 'col-span-2'}>
                    <Upload className="h-4 w-4 mr-2" /> Galeria
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
                </div>
              </>
            )}

            {/* GPS (opcional) */}
            {coords ? (
              <p className="text-xs text-success font-mono">✓ GPS {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</p>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleGps} disabled={gpsLoading} className="text-muted-foreground">
                {gpsLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />}
                Adicionar localização (opcional)
              </Button>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleConfirm} className={mode === 'finish' ? 'flex-1 bg-success hover:bg-success/90' : 'flex-1'}>
                <Check className="h-4 w-4 mr-2" /> {cfg.verb}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
