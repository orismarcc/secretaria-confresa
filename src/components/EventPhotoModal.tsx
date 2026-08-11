import { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useCamera } from '@/hooks/useCamera';
import { useGeolocation } from '@/hooks/useGeolocation';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, MapPin, Check, X, RotateCcw, Upload, Loader2, AlertCircle } from 'lucide-react';
import type { ServiceEventType } from '@/hooks/useServiceEvents';

const EVENT_LABEL: Record<string, { title: string; verb: string; hint: string }> = {
  start:  { title: 'Iniciar Atendimento',  verb: 'Iniciar',  hint: 'Foto no início (ex.: contador de km).' },
  pause:  { title: 'Pausar Atendimento',   verb: 'Pausar',   hint: 'Foto ao pausar (ex.: contador de km).' },
  resume: { title: 'Retomar Atendimento',  verb: 'Retomar',  hint: 'Foto ao retomar (ex.: contador de km).' },
};

interface EventPhotoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventType: ServiceEventType; // start | pause | resume
  serviceId: string | null;
  producerName?: string;
  demandName?: string;
  /** Chamado após a foto ser registrada com sucesso. */
  onSuccess: () => void;
}

export function EventPhotoModal({
  open, onOpenChange, eventType, serviceId, producerName, demandName, onSuccess,
}: EventPhotoModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const cfg = EVENT_LABEL[eventType] ?? EVENT_LABEL.start;

  const [step, setStep] = useState<'photo' | 'confirm'>('photo');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [note, setNote] = useState('');
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
      setStep('photo'); setPhotoBlob(null); setPhotoPreview(null);
      setCoords(null); setNote(''); setShowCamera(false); setPermDenied(false); setIsProcessing(false);
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
    if (blob) { setPhotoBlob(blob); setPhotoPreview(URL.createObjectURL(blob)); stopCamera(); setShowCamera(false); setStep('confirm'); }
  };
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const blob = await captureFromFile(file); if (blob) { setPhotoBlob(blob); setPhotoPreview(URL.createObjectURL(blob)); setStep('confirm'); } }
  };
  const handleRetake = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoBlob(null); setPhotoPreview(null); setStep('photo');
  };
  const handleGps = async () => {
    try { setCoords(await getCurrentPosition()); } catch { /* erro tratado no hook */ }
  };

  const handleConfirm = async () => {
    if (!serviceId || !photoBlob) return;
    setIsProcessing(true);
    try {
      const filename = `${serviceId}/${eventType}-${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('service-photos')
        .upload(filename, photoBlob, { contentType: 'image/jpeg', cacheControl: '3600' });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from('service_photos').insert({
        service_id: serviceId,
        storage_path: filename,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        captured_at: new Date().toISOString(),
        event_type: eventType,
        note: note.trim() || null,
      });
      if (dbErr) throw dbErr;
      queryClient.invalidateQueries({ queryKey: ['service_events'] });
      toast({ title: `${cfg.verb} registrado com foto!` });
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast({ title: 'Erro ao registrar', description: e?.message || 'Falha ao enviar a foto. Tente novamente.', variant: 'destructive' });
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

        {step === 'photo' && (
          <div className="space-y-4">
            {!showCamera && (
              <>
                <div className="text-center py-4">
                  <Camera className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-base font-medium mb-1">Tire uma foto para {cfg.verb.toLowerCase()}</p>
                  <p className="text-sm text-muted-foreground">{cfg.hint}</p>
                </div>
                {permDenied && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p className="text-xs">Permissão de câmera negada. Use a galeria ou libere a câmera nas configurações do navegador.</p>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {cameraSupported && !permDenied && (
                    <Button onClick={handleStartCamera} className="w-full">
                      <Camera className="h-4 w-4 mr-2" /> Abrir Câmera
                    </Button>
                  )}
                  <Button variant={permDenied ? 'default' : 'outline'} onClick={() => fileInputRef.current?.click()} className="w-full">
                    <Upload className="h-4 w-4 mr-2" /> Escolher da Galeria
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
                </div>
              </>
            )}
            {showCamera && (
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
            )}
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            {photoPreview && (
              <div className="relative aspect-[9/16] max-h-[42vh] rounded-lg overflow-hidden border mx-auto">
                <img src={photoPreview} alt="Foto" className="w-full h-full object-cover" />
                <Button size="icon" variant="secondary" onClick={handleRetake} className="absolute top-2 right-2">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            )}
            {coords ? (
              <p className="text-xs text-center text-success font-mono">✓ GPS {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</p>
            ) : (
              <Button variant="outline" size="sm" onClick={handleGps} disabled={gpsLoading} className="w-full">
                {gpsLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />}
                Adicionar localização (opcional)
              </Button>
            )}
            <div className="space-y-1">
              <Label htmlFor="event-note">Observação (opcional)</Label>
              <Textarea id="event-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ex.: km inicial 12.345" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={isProcessing}>Cancelar</Button>
              <Button onClick={handleConfirm} disabled={isProcessing || !photoBlob} className="flex-1">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : <><Check className="h-4 w-4 mr-2" /> {cfg.verb}</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
