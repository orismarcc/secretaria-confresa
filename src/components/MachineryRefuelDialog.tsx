import { useState, useRef, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useCamera } from '@/hooks/useCamera';
import { supabase } from '@/integrations/supabase/client';
import { Droplet, Trash2, Loader2, Plus, Camera, Upload, X, RotateCcw, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useMachineryRefuels,
  useCreateMachineryRefuel,
  useDeleteMachineryRefuel,
  type MachineryRefuel,
} from '@/hooks/useSupabaseData';

export const FUEL_TYPES = ['Diesel S10', 'Diesel S500', 'Gasolina'] as const;

interface MachineryRefuelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machineryId: string | null;
  machineryName?: string;
  /** Combustível padrão da máquina (pré-seleciona no formulário). */
  defaultFuelType?: string | null;
}

const fmtL = (n: number) => `${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} L`;
const fmtDateTime = (iso: string) => format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

async function openReceipt(path: string) {
  const { data } = await supabase.storage.from('service-photos').createSignedUrl(path, 3600);
  if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

export function MachineryRefuelDialog({
  open, onOpenChange, machineryId, machineryName, defaultFuelType,
}: MachineryRefuelDialogProps) {
  const { data: refuels = [], isLoading } = useMachineryRefuels(machineryId ?? undefined);
  const createRefuel = useCreateMachineryRefuel();
  const deleteRefuel = useDeleteMachineryRefuel();

  const [liters, setLiters] = useState('');
  const [fuelType, setFuelType] = useState<string>(defaultFuelType || '');
  const [note, setNote] = useState('');
  const [toDelete, setToDelete] = useState<MachineryRefuel | null>(null);
  const [saving, setSaving] = useState(false);

  // Foto do recibo/nota (opcional)
  const [receiptBlob, setReceiptBlob] = useState<Blob | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    isSupported: cameraSupported, isCapturing, error: cameraError,
    videoRef, canvasRef, startCamera, stopCamera, takePhoto, captureFromFile,
  } = useCamera();

  useEffect(() => {
    if (!open) { stopCamera(); }
  }, [open, stopCamera]);
  useEffect(() => () => { if (receiptPreview) URL.revokeObjectURL(receiptPreview); }, [receiptPreview]);

  const total = refuels.reduce((acc, r) => acc + Number(r.liters || 0), 0);

  const setReceipt = (blob: Blob) => {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptBlob(blob); setReceiptPreview(URL.createObjectURL(blob));
  };
  const handleOpenCamera = async () => {
    setShowCamera(true);
    const ok = await startCamera();
    if (!ok) setShowCamera(false);
  };
  const handleTakePhoto = async () => {
    const blob = await takePhoto();
    if (blob) setReceipt(blob);
    stopCamera(); setShowCamera(false);
  };
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { const blob = await captureFromFile(f); if (blob) setReceipt(blob); }
    e.target.value = '';
  };
  const clearReceipt = () => {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptBlob(null); setReceiptPreview(null);
  };

  const resetForm = () => { setLiters(''); setNote(''); clearReceipt(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineryId || saving) return;
    const litersNum = Number(String(liters).replace(',', '.'));
    if (!Number.isFinite(litersNum) || litersNum <= 0) return;

    setSaving(true);
    try {
      let receipt_path: string | null = null;
      if (receiptBlob) {
        const path = `refuels/${machineryId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage
          .from('service-photos')
          .upload(path, receiptBlob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: true });
        if (error) throw error;
        receipt_path = path;
      }
      await createRefuel.mutateAsync({
        machinery_id: machineryId,
        liters: litersNum,
        fuel_type: fuelType || defaultFuelType || null,
        // data/hora do cadastro = agora (registrado automaticamente)
        refueled_at: new Date().toISOString(),
        note: note.trim() || null,
        receipt_path,
      });
      resetForm();
    } catch {
      /* erro exibido pelo hook / storage */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) stopCamera(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplet className="h-5 w-5 text-blue-500" />
            Abastecimento — {machineryName}
          </DialogTitle>
          <DialogDescription>
            Total abastecido: <span className="font-semibold text-foreground">{fmtL(total)}</span>
          </DialogDescription>
        </DialogHeader>

        {showCamera ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">Foto do recibo/nota</p>
            <div className="relative aspect-[3/4] max-h-[55vh] bg-black rounded-lg overflow-hidden mx-auto">
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
          <>
            {/* Novo abastecimento */}
            <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="refuel-liters">Litros *</Label>
                  <Input id="refuel-liters" value={liters} onChange={(e) => setLiters(e.target.value)} placeholder="Ex: 45,5" inputMode="decimal" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Combustível</Label>
                  <Select value={fuelType} onValueChange={setFuelType}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {FUEL_TYPES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="refuel-note">Observação (opcional)</Label>
                <Input id="refuel-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: posto, responsável…" />
              </div>

              {/* Recibo/nota (opcional) */}
              <div className="space-y-1.5">
                <Label>Recibo / nota (opcional)</Label>
                {receiptPreview ? (
                  <div className="relative w-32 aspect-[3/4] rounded-lg overflow-hidden border">
                    <img src={receiptPreview} alt="Recibo" className="w-full h-full object-cover" />
                    <Button type="button" size="icon" variant="secondary" onClick={clearReceipt} className="absolute top-1 right-1 h-6 w-6">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {cameraSupported && (
                      <Button type="button" variant="outline" size="sm" onClick={handleOpenCamera}>
                        <Camera className="h-4 w-4 mr-2" /> Câmera
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className={cameraSupported ? '' : 'col-span-2'}>
                      <Upload className="h-4 w-4 mr-2" /> Galeria
                    </Button>
                    <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Registrar
                </Button>
              </div>
            </form>

            {/* Histórico */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Histórico</p>
              {isLoading ? (
                <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : refuels.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum abastecimento registrado.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y rounded-lg border">
                  {refuels.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{fmtL(r.liters)}{r.fuel_type ? ` · ${r.fuel_type}` : ''}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDateTime(r.refueled_at)}{r.note ? ` — ${r.note}` : ''}
                        </p>
                      </div>
                      {r.receipt_path && (
                        <Button type="button" variant="ghost" size="icon" className="shrink-0" title="Ver recibo" onClick={() => openReceipt(r.receipt_path!)}>
                          <Receipt className="h-4 w-4 text-blue-500" />
                        </Button>
                      )}
                      <Button
                        type="button" variant="ghost" size="icon"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={() => setToDelete(r)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => { if (!o) setToDelete(null); }}
        title="Remover abastecimento"
        description={toDelete ? `Remover o registro de ${fmtL(toDelete.liters)}? Esta ação não pode ser desfeita.` : ''}
        onConfirm={() => {
          if (toDelete) deleteRefuel.mutate({ id: toDelete.id, machinery_id: toDelete.machinery_id });
          setToDelete(null);
        }}
        confirmLabel="Remover"
        variant="destructive"
      />
    </Dialog>
  );
}
