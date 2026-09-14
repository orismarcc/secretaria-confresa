import { useState } from 'react';
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
import { Droplet, Trash2, Loader2, Plus } from 'lucide-react';
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

export function MachineryRefuelDialog({
  open, onOpenChange, machineryId, machineryName, defaultFuelType,
}: MachineryRefuelDialogProps) {
  const { data: refuels = [], isLoading } = useMachineryRefuels(machineryId ?? undefined);
  const createRefuel = useCreateMachineryRefuel();
  const deleteRefuel = useDeleteMachineryRefuel();

  const [liters, setLiters] = useState('');
  const [fuelType, setFuelType] = useState<string>(defaultFuelType || '');
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [toDelete, setToDelete] = useState<MachineryRefuel | null>(null);

  const total = refuels.reduce((acc, r) => acc + Number(r.liters || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineryId) return;
    const litersNum = Number(String(liters).replace(',', '.'));
    if (!Number.isFinite(litersNum) || litersNum <= 0) return;
    await createRefuel.mutateAsync({
      machinery_id: machineryId,
      liters: litersNum,
      fuel_type: fuelType || defaultFuelType || null,
      refueled_at: new Date(`${date}T12:00:00`).toISOString(),
      note: note.trim() || null,
    });
    setLiters(''); setNote('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

        {/* Novo abastecimento */}
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="refuel-liters">Litros *</Label>
              <Input
                id="refuel-liters"
                value={liters}
                onChange={(e) => setLiters(e.target.value)}
                placeholder="Ex: 45,5"
                inputMode="decimal"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="refuel-date">Data</Label>
              <Input id="refuel-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Combustível</Label>
            <Select value={fuelType} onValueChange={setFuelType}>
              <SelectTrigger><SelectValue placeholder="Selecione o combustível" /></SelectTrigger>
              <SelectContent>
                {FUEL_TYPES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="refuel-note">Observação (opcional)</Label>
            <Input id="refuel-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: posto, responsável…" />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={createRefuel.isPending}>
              {createRefuel.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
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
                      {format(new Date(r.refueled_at), 'dd/MM/yyyy', { locale: ptBR })}
                      {r.note ? ` — ${r.note}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="ghost" size="icon"
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
