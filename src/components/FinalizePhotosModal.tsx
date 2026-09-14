import { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCamera } from '@/hooks/useCamera';
import { Camera, Check, X, RotateCcw, Upload, Loader2, AlertCircle } from 'lucide-react';

type Slot = 'start' | 'finish';

interface FinalizePhotosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producerName?: string;
  demandName?: string;
  /** Recebe as duas fotos (ambas opcionais, podem ser null). Não fala com o servidor. */
  onConfirm: (data: { startPhotoBlob: Blob | null; finishPhotoBlob: Blob | null }) => void;
}

/**
 * Finalização do atendimento com DOIS campos de foto: início e término do
 * serviço. Ambas OPCIONAIS — não bloqueiam o Finalizar. A localização (GPS)
 * já foi captada ao Iniciar; aqui não há GPS.
 */
export function FinalizePhotosModal({
  open, onOpenChange, producerName, demandName, onConfirm,
}: FinalizePhotosModalProps) {
  const [startBlob, setStartBlob] = useState<Blob | null>(null);
  const [startPreview, setStartPreview] = useState<string | null>(null);
  const [finishBlob, setFinishBlob] = useState<Blob | null>(null);
  const [finishPreview, setFinishPreview] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null); // slot com a câmera aberta
  const [permDenied, setPermDenied] = useState(false);
  const startInputRef = useRef<HTMLInputElement>(null);
  const finishInputRef = useRef<HTMLInputElement>(null);

  const {
    isSupported: cameraSupported, isCapturing, error: cameraError,
    videoRef, canvasRef, startCamera, stopCamera, takePhoto, captureFromFile,
  } = useCamera();

  useEffect(() => {
    if (open) {
      setStartBlob(null); setStartPreview(null);
      setFinishBlob(null); setFinishPreview(null);
      setActiveSlot(null); setPermDenied(false);
    } else {
      stopCamera();
    }
  }, [open, stopCamera]);

  useEffect(() => () => {
    if (startPreview) URL.revokeObjectURL(startPreview);
    if (finishPreview) URL.revokeObjectURL(finishPreview);
  }, [startPreview, finishPreview]);

  const setSlotPhoto = (slot: Slot, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    if (slot === 'start') {
      if (startPreview) URL.revokeObjectURL(startPreview);
      setStartBlob(blob); setStartPreview(url);
    } else {
      if (finishPreview) URL.revokeObjectURL(finishPreview);
      setFinishBlob(blob); setFinishPreview(url);
    }
  };

  const handleOpenCamera = async (slot: Slot) => {
    setPermDenied(false);
    setActiveSlot(slot);
    const ok = await startCamera();
    if (!ok) { setActiveSlot(null); setPermDenied(true); }
  };

  const handleTakePhoto = async () => {
    if (!activeSlot) return;
    const blob = await takePhoto();
    if (blob) { setSlotPhoto(activeSlot, blob); }
    stopCamera(); setActiveSlot(null);
  };

  const handleFileSelect = async (slot: Slot, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const blob = await captureFromFile(file); if (blob) setSlotPhoto(slot, blob); }
    e.target.value = ''; // permite reescolher o mesmo arquivo
  };

  const handleRetake = (slot: Slot) => {
    if (slot === 'start') {
      if (startPreview) URL.revokeObjectURL(startPreview);
      setStartBlob(null); setStartPreview(null);
    } else {
      if (finishPreview) URL.revokeObjectURL(finishPreview);
      setFinishBlob(null); setFinishPreview(null);
    }
  };

  const handleConfirm = () => {
    onConfirm({ startPhotoBlob: startBlob, finishPhotoBlob: finishBlob });
    onOpenChange(false);
  };

  const renderSlot = (slot: Slot, label: string, preview: string | null, inputRef: React.RefObject<HTMLInputElement>) => (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {preview ? (
        <div className="relative w-full aspect-[9/16] max-h-[32vh] rounded-lg overflow-hidden border mx-auto">
          <img src={preview} alt={label} className="w-full h-full object-cover" />
          <Button size="icon" variant="secondary" onClick={() => handleRetake(slot)} className="absolute top-2 right-2">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {cameraSupported && !permDenied && (
            <Button variant="outline" onClick={() => handleOpenCamera(slot)}>
              <Camera className="h-4 w-4 mr-2" /> Câmera
            </Button>
          )}
          <Button variant="outline" onClick={() => inputRef.current?.click()} className={cameraSupported && !permDenied ? '' : 'col-span-2'}>
            <Upload className="h-4 w-4 mr-2" /> Galeria
          </Button>
          <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleFileSelect(slot, e)} className="hidden" />
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) stopCamera(); onOpenChange(o); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalizar Atendimento</DialogTitle>
          <DialogDescription>{producerName}{demandName ? ` — ${demandName}` : ''}</DialogDescription>
        </DialogHeader>

        {activeSlot ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Foto de {activeSlot === 'start' ? 'início' : 'término'} do serviço
            </p>
            <div className="relative aspect-[9/16] max-h-[55vh] bg-black rounded-lg overflow-hidden mx-auto">
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
              <Button variant="outline" onClick={() => { stopCamera(); setActiveSlot(null); }} className="flex-1">
                <X className="h-4 w-4 mr-2" /> Cancelar
              </Button>
              <Button onClick={handleTakePhoto} disabled={!isCapturing} className="flex-1">
                <Camera className="h-4 w-4 mr-2" /> Tirar Foto
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Registre as fotos do serviço (opcional).</p>

            {permDenied && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                Câmera negada. Use a galeria ou libere nas configurações do navegador.
              </div>
            )}

            {renderSlot('start', 'Início do serviço', startPreview, startInputRef)}
            {renderSlot('finish', 'Término do serviço', finishPreview, finishInputRef)}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleConfirm} className="flex-1 bg-success hover:bg-success/90">
                <Check className="h-4 w-4 mr-2" /> Finalizar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
