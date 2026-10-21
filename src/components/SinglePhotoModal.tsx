import { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCamera } from '@/hooks/useCamera';
import { Camera, Check, X, RotateCcw, Upload, Loader2, AlertCircle, MapPin } from 'lucide-react';
import { lerPosicaoPrecisa, dentroDaRegiao, type LeituraGps } from '@/lib/gpsPreciso';
import { lerExifFoto, type ExifFoto } from '@/lib/exifFoto';

/** De onde veio a foto e a localização ligada a ela. */
export interface InfoFoto {
  origem: 'camera' | 'galeria';
  /** Leitura do GPS iniciada NO MOMENTO da foto (câmera) ou da escolha (galeria
   *  sem localização própria). Resolve em até ~8 s; null se o GPS não respondeu. */
  leitura: Promise<LeituraGps | null>;
  /** Galeria: localização/hora gravadas na própria foto (quando houver). */
  exif: ExifFoto | null;
}

interface SinglePhotoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Linha abaixo do título (produtor — serviço). */
  subtitle?: string;
  /** O que a foto deve mostrar (ex.: "Caminhão sendo carregado"). */
  photoLabel: string;
  /** Explicação curta do que será registrado. */
  hint?: string;
  confirmLabel: string;
  confirmClassName?: string;
  /** Recebe a foto (obrigatória) e a origem/localização dela. Não fala com o servidor. */
  onConfirm: (photo: Blob, info: InfoFoto) => void;
}

/**
 * Registro com UMA foto obrigatória (câmera ou galeria). Usado nas etapas da
 * logística (odômetro no início e na finalização, carregamento e entrega).
 * A localização é lida NA HORA DA FOTO (não ao confirmar): o operador pode
 * tirar a foto e só tocar em registrar depois de sair do local. Foto da galeria
 * usa a localização gravada nela (EXIF), quando houver.
 */
export function SinglePhotoModal({
  open, onOpenChange, title, subtitle, photoLabel, hint, confirmLabel, confirmClassName, onConfirm,
}: SinglePhotoModalProps) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const infoRef = useRef<InfoFoto | null>(null);

  const {
    isSupported: cameraSupported, isCapturing, error: cameraError,
    videoRef, canvasRef, startCamera, stopCamera, takePhoto, captureFromFile,
  } = useCamera();

  useEffect(() => {
    if (open) {
      setBlob(null); setPreview(null); setCameraOpen(false); setPermDenied(false);
      infoRef.current = null;
    } else {
      stopCamera();
    }
  }, [open, stopCamera]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const setPhoto = (b: Blob) => {
    if (preview) URL.revokeObjectURL(preview);
    setBlob(b); setPreview(URL.createObjectURL(b));
  };

  const openCamera = async () => {
    setPermDenied(false);
    setCameraOpen(true);
    const ok = await startCamera();
    if (!ok) { setCameraOpen(false); setPermDenied(true); }
  };

  const shoot = async () => {
    const b = await takePhoto();
    if (b) {
      infoRef.current = { origem: 'camera', leitura: lerPosicaoPrecisa(), exif: null };
      setPhoto(b);
    }
    stopCamera(); setCameraOpen(false);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // O EXIF é lido do arquivo ORIGINAL (a imagem é recomprimida logo abaixo).
      const exif = await lerExifFoto(file);
      const b = await captureFromFile(file);
      if (b) {
        const temLocal = exif?.latitude != null && exif.longitude != null && dentroDaRegiao(exif.latitude, exif.longitude);
        infoRef.current = { origem: 'galeria', exif, leitura: temLocal ? Promise.resolve(null) : lerPosicaoPrecisa() };
        setPhoto(b);
      }
    }
    e.target.value = '';
  };

  const retake = () => {
    if (preview) URL.revokeObjectURL(preview);
    setBlob(null); setPreview(null);
    infoRef.current = null;
  };

  const confirm = () => {
    if (!blob) return;
    onConfirm(blob, infoRef.current ?? { origem: 'camera', leitura: lerPosicaoPrecisa(), exif: null });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) stopCamera(); onOpenChange(o); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>

        {cameraOpen ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">{photoLabel}</p>
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
              <Button variant="outline" onClick={() => { stopCamera(); setCameraOpen(false); }} className="flex-1">
                <X className="h-4 w-4 mr-2" /> Cancelar
              </Button>
              <Button onClick={shoot} disabled={!isCapturing} className="flex-1">
                <Camera className="h-4 w-4 mr-2" /> Tirar Foto
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {hint && (
              <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                <span>{hint}</span>
              </div>
            )}

            {permDenied && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                Câmera negada. Use a galeria ou libere nas configurações do navegador.
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">{photoLabel} <span className="text-destructive">*</span></p>
              {preview ? (
                <div className="relative w-full aspect-[9/16] max-h-[40vh] rounded-lg overflow-hidden border mx-auto">
                  <img src={preview} alt={photoLabel} className="w-full h-full object-cover" />
                  <Button size="icon" variant="secondary" onClick={retake} className="absolute top-2 right-2">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {cameraSupported && !permDenied && (
                    <Button variant="outline" onClick={openCamera}>
                      <Camera className="h-4 w-4 mr-2" /> Câmera
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => inputRef.current?.click()} className={cameraSupported && !permDenied ? '' : 'col-span-2'}>
                    <Upload className="h-4 w-4 mr-2" /> Galeria
                  </Button>
                  <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
                </div>
              )}
              {!preview && <p className="text-[11px] text-muted-foreground">A foto é obrigatória.</p>}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
              <Button onClick={confirm} disabled={!blob} className={confirmClassName || 'flex-1'}>
                <Check className="h-4 w-4 mr-2" /> {confirmLabel}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
