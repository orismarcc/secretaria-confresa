import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ServiceWithRelations, ServicePhoto } from '@/types';
import { useCamera } from '@/hooks/useCamera';
import { useGeolocation } from '@/hooks/useGeolocation';
import { savePhotoBlob } from '@/lib/imageStorage';
import { Camera, MapPin, Check, X, RotateCcw, Upload, Loader2 } from 'lucide-react';

interface FinalizeServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceWithRelations | null;
  onFinalize: (data: {
    photo?: ServicePhoto;
    latitude?: number;
    longitude?: number;
  }) => void;
}

type Step = 'photo' | 'gps' | 'confirm';

export function FinalizeServiceModal({
  open,
  onOpenChange,
  service,
  onFinalize,
}: FinalizeServiceModalProps) {
  const [step, setStep] = useState<Step>('photo');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [capturedCoords, setCapturedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    isSupported: cameraSupported,
    isCapturing,
    error: cameraError,
    videoRef,
    canvasRef,
    startCamera,
    stopCamera,
    takePhoto,
    captureFromFile,
  } = useCamera();
  
  const {
    latitude,
    longitude,
    error: gpsError,
    isLoading: gpsLoading,
    getCurrentPosition,
  } = useGeolocation();

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('photo');
      setPhotoBlob(null);
      setPhotoPreview(null);
      setCapturedCoords(null);
      setShowCamera(false);
    } else {
      stopCamera();
    }
  }, [open, stopCamera]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const handleStartCamera = async () => {
    setShowCamera(true);
    await startCamera();
  };

  const handleTakePhoto = async () => {
    const blob = await takePhoto();
    if (blob) {
      setPhotoBlob(blob);
      setPhotoPreview(URL.createObjectURL(blob));
      stopCamera();
      setShowCamera(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const blob = await captureFromFile(file);
      if (blob) {
        setPhotoBlob(blob);
        setPhotoPreview(URL.createObjectURL(blob));
      }
    }
  };

  const handleRetakePhoto = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoBlob(null);
    setPhotoPreview(null);
  };

  const handleSkipPhoto = () => {
    setStep('gps');
  };

  const handleCaptureGps = async () => {
    try {
      const coords = await getCurrentPosition();
      setCapturedCoords(coords);
    } catch (err) {
      // Error is already in the hook state
    }
  };

  const handleSkipGps = () => {
    setStep('confirm');
  };

  const handleProceedToGps = () => {
    setStep('gps');
  };

  const handleProceedToConfirm = () => {
    setStep('confirm');
  };

  const handleConfirmFinalize = async () => {
    if (!service) return;
    
    setIsProcessing(true);
    
    try {
      let savedPhoto: ServicePhoto | undefined;
      
      // Save photo to IndexedDB if captured
      if (photoBlob) {
        savedPhoto = await savePhotoBlob(
          photoBlob,
          service.id,
          service.producerId,
          service.demandTypeId
        );
      }
      
      // Call the finalize handler with captured data
      onFinalize({
        photo: savedPhoto,
        latitude: capturedCoords?.latitude,
        longitude: capturedCoords?.longitude,
      });
      
      onOpenChange(false);
    } catch (err) {
      console.error('Erro ao finalizar:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    onOpenChange(false);
  };

  if (!service) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Finalizar Atendimento</DialogTitle>
          <DialogDescription>
            {service.producer?.name} - {service.demandType?.name}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Photo */}
        {step === 'photo' && (
          <div className="space-y-4">
            {!showCamera && !photoPreview && (
              <>
                <div className="text-center py-6">
                  <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">
                    Deseja tirar uma foto do serviço realizado?
                  </p>
                  <p className="text-sm text-muted-foreground">
                    A foto será vinculada ao atendimento
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {cameraSupported && (
                    <Button onClick={handleStartCamera} className="w-full">
                      <Camera className="h-4 w-4 mr-2" />
                      Abrir Câmera
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Escolher da Galeria
                  </Button>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  <Button variant="ghost" onClick={handleSkipPhoto} className="w-full">
                    Pular esta etapa
                  </Button>
                </div>
              </>
            )}

            {/* Camera View */}
            {showCamera && (
              <div className="space-y-4">
                <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {!isCapturing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                    </div>
                  )}
                </div>
                
                {cameraError && (
                  <p className="text-sm text-destructive text-center">{cameraError}</p>
                )}
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      stopCamera();
                      setShowCamera(false);
                    }}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                  
                  <Button
                    onClick={handleTakePhoto}
                    disabled={!isCapturing}
                    className="flex-1"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Tirar Foto
                  </Button>
                </div>
              </div>
            )}

            {/* Photo Preview */}
            {photoPreview && (
              <div className="space-y-4">
                <div className="relative aspect-[4/3] rounded-lg overflow-hidden border">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={handleRetakePhoto}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <p className="text-sm text-center text-success">
                  ✓ Foto capturada com sucesso
                </p>
                
                <Button onClick={handleProceedToGps} className="w-full">
                  Continuar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: GPS */}
        {step === 'gps' && (
          <div className="space-y-4">
            <div className="text-center py-6">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                Adicionar localização atual?
              </p>
              <p className="text-sm text-muted-foreground">
                As coordenadas GPS serão vinculadas ao atendimento
              </p>
            </div>

            {capturedCoords ? (
              <div className="bg-muted p-4 rounded-lg text-center">
                <p className="text-sm font-medium text-success mb-2">
                  ✓ Localização capturada
                </p>
                <p className="text-sm font-mono">
                  Lat: {capturedCoords.latitude.toFixed(6)}
                </p>
                <p className="text-sm font-mono">
                  Long: {capturedCoords.longitude.toFixed(6)}
                </p>
              </div>
            ) : gpsError ? (
              <div className="bg-destructive/10 p-4 rounded-lg text-center">
                <p className="text-sm text-destructive">{gpsError}</p>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              {!capturedCoords && (
                <Button
                  onClick={handleCaptureGps}
                  disabled={gpsLoading}
                  className="w-full"
                >
                  {gpsLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Obtendo localização...
                    </>
                  ) : (
                    <>
                      <MapPin className="h-4 w-4 mr-2" />
                      Usar minha localização
                    </>
                  )}
                </Button>
              )}
              
              {capturedCoords ? (
                <Button onClick={handleProceedToConfirm} className="w-full">
                  Continuar
                </Button>
              ) : (
                <Button variant="ghost" onClick={handleSkipGps} className="w-full">
                  Pular esta etapa
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <Check className="h-12 w-12 mx-auto mb-4 text-success" />
              <p className="text-lg font-medium mb-2">
                Confirmar finalização?
              </p>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm">
                <strong>Produtor:</strong> {service.producer?.name}
              </p>
              <p className="text-sm">
                <strong>Serviço:</strong> {service.demandType?.name}
              </p>
              <p className="text-sm">
                <strong>Foto:</strong> {photoBlob ? '✓ Capturada' : 'Não tirada'}
              </p>
              <p className="text-sm">
                <strong>GPS:</strong>{' '}
                {capturedCoords
                  ? `${capturedCoords.latitude.toFixed(4)}, ${capturedCoords.longitude.toFixed(4)}`
                  : 'Não capturado'}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={isProcessing}
              >
                Cancelar
              </Button>
              
              <Button
                onClick={handleConfirmFinalize}
                disabled={isProcessing}
                className="flex-1 bg-success hover:bg-success/90"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Finalizar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
