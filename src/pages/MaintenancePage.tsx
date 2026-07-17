import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Wrench, Clock, CalendarDays, User, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useMachinery } from '@/hooks/useSupabaseData';
import { useOperators } from '@/hooks/useOperatorData';
import {
  useMaintenances, useCreateMaintenance, useUpdateMaintenance, useDeleteMaintenance,
  maintenanceMinutes, formatDuration, type MaintenanceRow,
} from '@/hooks/useMaintenanceData';

// ── Helpers de data/hora ─────────────────────────────────────────────────────
const parseTs = (raw: string) => new Date(raw.replace(' ', 'T'));
const buildIso = (date: string, time: string): string => new Date(`${date}T${time}:00`).toISOString();
const isoToParts = (raw: string | null): { date: string; time: string } => {
  if (!raw) return { date: '', time: '' };
  const d = parseTs(raw);
  if (isNaN(d.getTime())) return { date: '', time: '' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};

interface FormState {
  machineryId: string;
  operatorId: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
}

const EMPTY: FormState = { machineryId: '', operatorId: 'none', date: '', startTime: '', endTime: '', description: '' };

export default function MaintenancePage() {
  const { data: maintenances = [], isLoading } = useMaintenances();
  const { data: machinery = [] } = useMachinery();
  const { data: operators = [] } = useOperators();
  const createM = useCreateMaintenance();
  const updateM = useUpdateMaintenance();
  const deleteM = useDeleteMaintenance();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [toDelete, setToDelete] = useState<MaintenanceRow | null>(null);

  const activeMachinery = useMemo(
    () => (machinery as any[]).filter((m) => m.is_active),
    [machinery],
  );
  const operatorName = useMemo(() => {
    const map = new Map<string, string>();
    (operators as any[]).forEach((o) => map.set(o.id, o.name));
    return map;
  }, [operators]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY, date: format(new Date(), 'yyyy-MM-dd') });
    setFormOpen(true);
  };

  const openEdit = (m: MaintenanceRow) => {
    const s = isoToParts(m.started_at);
    const e = isoToParts(m.ended_at);
    setEditingId(m.id);
    setForm({
      machineryId: m.machinery_id,
      operatorId: m.operator_id || 'none',
      date: s.date,
      startTime: s.time,
      endTime: e.time,
      description: m.description,
    });
    setFormOpen(true);
  };

  const setF = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const invalidTime = !!form.endTime && !!form.startTime && form.endTime < form.startTime;
  const canSubmit =
    !!form.machineryId && !!form.date && !!form.startTime && !!form.description.trim() && !invalidTime;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const payload = {
      machinery_id: form.machineryId,
      operator_id: form.operatorId !== 'none' ? form.operatorId : null,
      description: form.description.trim(),
      started_at: buildIso(form.date, form.startTime),
      ended_at: form.endTime ? buildIso(form.date, form.endTime) : null,
    };
    if (editingId) {
      updateM.mutate({ id: editingId, ...payload }, { onSuccess: () => setFormOpen(false) });
    } else {
      createM.mutate(payload, { onSuccess: () => setFormOpen(false) });
    }
  };

  const finalizeNow = (m: MaintenanceRow) => {
    updateM.mutate({ id: m.id, ended_at: new Date().toISOString() });
  };

  const confirmDelete = () => {
    if (toDelete) deleteM.mutate(toDelete.id, { onSuccess: () => setToDelete(null) });
  };

  return (
    <AppLayout>
      <PageHeader
        title="Manutenções"
        description="Registro de manutenções e reparos de maquinários"
        action={{ label: 'Nova manutenção', onClick: openNew, icon: <Plus className="h-4 w-4 mr-2" /> }}
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : maintenances.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Wrench className="h-12 w-12 opacity-30" />
          <p>Nenhuma manutenção registrada</p>
          <Button variant="outline" onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Registrar a primeira
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {maintenances.map((m) => {
            const ongoing = !m.ended_at;
            const minutes = maintenanceMinutes(m);
            const started = parseTs(m.started_at);
            const ended = m.ended_at ? parseTs(m.ended_at) : null;
            return (
              <div
                key={m.id}
                className={cn(
                  'rounded-xl border bg-card p-4 flex flex-col gap-2.5 shadow-sm',
                  ongoing && 'border-amber-300 bg-amber-50/40',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn('p-2 rounded-lg shrink-0', ongoing ? 'bg-amber-500/15' : 'bg-muted')}>
                      <Wrench className={cn('h-4 w-4', ongoing ? 'text-amber-600' : 'text-muted-foreground')} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{m.machinery?.name || 'Maquinário'}</p>
                      {m.machinery?.patrimony_number && (
                        <p className="text-[11px] text-muted-foreground">Nº {m.machinery.patrimony_number}</p>
                      )}
                    </div>
                  </div>
                  {ongoing ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-500/15 border border-amber-300 rounded-full px-2 py-0.5 shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Em andamento
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-500/10 border border-emerald-200 rounded-full px-2 py-0.5 shrink-0">
                      <CheckCircle className="h-3 w-3" /> Concluída
                    </span>
                  )}
                </div>

                <p className="text-sm text-foreground/90 line-clamp-3">{m.description}</p>

                <div className="mt-auto space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {format(started, 'dd/MM/yyyy', { locale: ptBR })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {format(started, 'HH:mm')}
                    {ended ? ` – ${format(ended, 'HH:mm')}` : ' – …'}
                    {!ongoing && minutes > 0 && (
                      <span className="ml-1 font-semibold text-foreground">· {formatDuration(minutes)}</span>
                    )}
                  </div>
                  {m.operator_id && operatorName.get(m.operator_id) && (
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      {operatorName.get(m.operator_id)}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 pt-1 border-t">
                  {ongoing && (
                    <Button variant="ghost" size="sm" className="text-emerald-700 hover:text-emerald-700 gap-1 h-8" onClick={() => finalizeNow(m)}>
                      <CheckCircle className="h-3.5 w-3.5" /> Finalizar
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={() => openEdit(m)} title="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setToDelete(m)} title="Excluir">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Formulário */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar manutenção' : 'Nova manutenção'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Maquinário *</Label>
              <Select value={form.machineryId} onValueChange={(v) => setF({ machineryId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o maquinário" /></SelectTrigger>
                <SelectContent>
                  {activeMachinery.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum maquinário ativo</div>
                  ) : activeMachinery.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}{m.patrimony_number ? ` · Nº ${m.patrimony_number}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Operador que acompanhou (opcional)</Label>
              <Select value={form.operatorId} onValueChange={(v) => setF({ operatorId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {(operators as any[]).filter((o) => o.is_active).map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input type="date" value={form.date} onChange={(e) => setF({ date: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Hora início *</Label>
                <Input type="time" value={form.startTime} onChange={(e) => setF({ startTime: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Hora fim</Label>
                <Input type="time" value={form.endTime} onChange={(e) => setF({ endTime: e.target.value })} />
              </div>
            </div>
            {invalidTime && (
              <p className="text-xs text-destructive">A hora de fim deve ser maior ou igual à de início.</p>
            )}
            {!form.endTime && (
              <p className="text-xs text-muted-foreground">Deixe a hora de fim vazia se ainda estiver em andamento (aparecerá no Dashboard).</p>
            )}

            <div className="space-y-1.5">
              <Label>Descrição do problema *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setF({ description: e.target.value })}
                placeholder="Ex.: troca de correia, reparo hidráulico, superaquecimento do motor..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || createM.isPending || updateM.isPending}>
              {editingId ? 'Salvar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => { if (!o) setToDelete(null); }}
        title="Excluir manutenção"
        description="Tem certeza que deseja excluir este registro de manutenção? Esta ação não pode ser desfeita."
        onConfirm={confirmDelete}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </AppLayout>
  );
}
