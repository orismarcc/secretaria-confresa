import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRightLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useCreatePatrimonyTransfer } from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type Condition = 'otimo' | 'bom' | 'ruim' | 'pessimo';

export interface PatrimonyTransferItem {
  id: string;
  name: string;
  location: string | null;
  responsible_name: string | null;
  responsible_phone: string | null;
  condition: Condition | null;
}

interface PatrimonyTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PatrimonyTransferItem | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PatrimonyTransferDialog({
  open,
  onOpenChange,
  item,
}: PatrimonyTransferDialogProps) {
  const createTransfer = useCreatePatrimonyTransfer();

  const [transferDate, setTransferDate]       = useState('');
  const [location, setLocation]               = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [responsiblePhone, setResponsiblePhone] = useState('');
  const [condition, setCondition]             = useState<Condition | ''>('');
  const [notes, setNotes]                     = useState('');

  // Pre-populate with current item values on open
  useEffect(() => {
    if (open && item) {
      setTransferDate(format(new Date(), 'yyyy-MM-dd'));
      setLocation(item.location ?? '');
      setResponsibleName(item.responsible_name ?? '');
      setResponsiblePhone(item.responsible_phone ?? '');
      setCondition((item.condition ?? '') as Condition | '');
      setNotes('');
    }
  }, [open, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    const { data: { user } } = await supabase.auth.getUser();

    createTransfer.mutate(
      {
        transfer: {
          patrimony_id: item.id,
          transferred_at: transferDate,
          location: location.trim() || null,
          responsible_name: responsibleName.trim() || null,
          responsible_phone: responsiblePhone.trim() || null,
          condition: (condition || null) as Condition | null,
          notes: notes.trim() || null,
          created_by: user?.id ?? null,
        },
        patrimonyId: item.id,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Registrar Movimentação
          </DialogTitle>
        </DialogHeader>

        {item && (
          <p className="text-sm text-muted-foreground -mt-2 pb-1 border-b">
            <span className="font-medium text-foreground">{item.name}</span>
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="tr-date">Data da Movimentação *</Label>
            <Input
              id="tr-date"
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              required
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="tr-location">Nova Localização</Label>
            <Input
              id="tr-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: Secretaria de Obras"
            />
          </div>

          {/* Responsible */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="tr-resp-name">Novo Responsável</Label>
              <Input
                id="tr-resp-name"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                placeholder="Nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tr-resp-phone">WhatsApp</Label>
              <Input
                id="tr-resp-phone"
                value={responsiblePhone}
                onChange={(e) => setResponsiblePhone(e.target.value)}
                placeholder="(66) 99999-9999"
              />
            </div>
          </div>

          {/* Condition */}
          <div className="space-y-2">
            <Label htmlFor="tr-condition">Estado de Conservação</Label>
            <select
              id="tr-condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value as Condition | '')}
              className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-medium
                ${condition === 'otimo'   ? 'bg-green-50 border-green-300 text-green-800' :
                  condition === 'bom'     ? 'bg-blue-50  border-blue-300  text-blue-800'  :
                  condition === 'ruim'    ? 'bg-yellow-50 border-yellow-300 text-yellow-800' :
                  condition === 'pessimo' ? 'bg-red-50   border-red-300   text-red-800'   :
                  'bg-background border-input text-foreground'}`}
            >
              <option value="">Selecionar</option>
              <option value="otimo">✓ Ótimo</option>
              <option value="bom">◎ Bom</option>
              <option value="ruim">⚠ Ruim</option>
              <option value="pessimo">✕ Péssimo</option>
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="tr-notes">Observação</Label>
            <Textarea
              id="tr-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Motivo da movimentação, detalhes relevantes..."
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createTransfer.isPending}>
              {createTransfer.isPending ? 'Registrando...' : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
