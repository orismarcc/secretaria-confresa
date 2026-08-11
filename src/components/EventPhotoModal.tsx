import { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCamera } from '@/hooks/useCamera';
import { useGeolocation } from '@/hooks/useGeolocation';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, MapPin, Check, X, RotateCcw, Upload, Loader2, AlertCircle, Gauge } from 'lucide-react';
import type { ServiceEventType } from '@/hooks/useServiceEvents';

const EVENT_LABEL: Record<string, { title: string; verb: string }> = {
  start:  { title: 'Iniciar Atendimento',  verb: 'Iniciar' },
  pause:  { title: 'Pausar Atendimento',   verb: 'Pausar' },
  resume: { title: 'Retomar Atendimento',  verb: 'Retomar' },
};

interface EventPhotoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventType: ServiceEventType; // start | pause | resume
  serviceId: string | null;
  producerName?: string;
  demandName?: string;
  onSuccess: () => void;
}

function parseKm(v: string): number | null {
  const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

export function EventPhotoModal({
  open, onOpenChange, eventType, serviceId, producerName, demandName, onSuccess,
}: EventPhotoModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const cfg = EVENT_LABEL[eventType] ?? EVENT_LABEL.start;

  const [km, setKm] = useState('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isSupported: cameraSupported, isCapturing, error: cameraError,
    videoRef, canvasRef, startCamera, stopCamera, takePhoto, captureFromFile,
  } = useCamera();
  const { getCurrentPosition, isLoading: gpsLoading } = useGeolocation();

  useEffect(() => {
    if (open) {
      setKm(''); setPhotoBlob(null); setPhotoPreview(null);
      setCoords(null); setShowCamera(false); setPermDenied(false); setIsProcessing(false);
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

  const handleConfirm = async () => {
    if (!serviceId) return;
    setIsProcessing(true);
    try {
      let storagePath: string | null = null;
      if (photoBlob) {
        const filename = `${serviceId}/${eventType}-${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from('service-photos')
          .upload(filename, photoBlob, { contentType: 'image/jpeg', cacheControl: '3600' });
        if (upErr) throw upErr;
        storagePath = filename;
      }
      const { error: dbErr } = await supabase.from('service_photos').insert({
        service_id: serviceId,
        storage_path: storagePath,
        odometer_km: parseKm(km),
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        captured_at: new Date().toISOString(),
        event_type: eventType,
      });
      if (dbErr) throw dbErr;
      queryClient.invalidateQueries({ queryKey: ['service_events'] });
      toast({ title: `${cfg.verb} registrado!` });
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast({ title: 'Erro ao registrar', description: e?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
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
            {/* Km do odômetro */}
            <div className="space-y-1.5">
              <Label htmlFor="event-km" className="flex items-center gap-1.5">
                <Gauge className="h-4 w-4 text-muted-foreground" /> Km do odômetro
              </Label>
              <Input
                id="event-km"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                placeholder="Ex.: 12345"
                inputMode="decimal"
                autoFocus
              />
            </div>

            {/* Foto do odômetro (opcional) */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Foto do odômetro (opcional)</Label>
              {photoPreview ? (
                <div className="relative w-full h-40 rounded-lg overflow-hidden border">
                  <img src={photoPreview} alt="Odômetro" className="w-full h-full object-cover" />
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
            </div>

            {/* GPS opcional */}
            {coords ? (
              <p className="text-xs text-success font-mono">✓ GPS {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</p>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleGps} disabled={gpsLoading} className="text-muted-foreground">
                {gpsLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />}
                Adicionar localização (opcional)
              </Button>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={isProcessing}>Cancelar</Button>
              <Button onClick={handleConfirm} disabled={isProcessing} className="flex-1">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : <><Check className="h-4 w-4 mr-2" /> {cfg.verb}</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
