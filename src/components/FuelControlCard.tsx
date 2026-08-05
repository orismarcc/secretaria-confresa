import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Fuel, Plus, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFuelUsage, useUpsertFuelUsage, useDeleteFuelUsage, type FuelUsageRow } from '@/hooks/useFuelData';

const KNOWN_FUELS = [
  'Gasolina', 'Gasolina Aditivada', 'Álcool', 'Diesel', 'Diesel S10',
  'Diesel Aditivado', 'GNV', 'QAV', 'Arla 32',
];

const fmtL = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthKey = (d: string) => d.slice(0, 7); // YYYY-MM
const monthLabel = (ym: string) => {
  try { return format(parseISO(ym + '-01'), 'MMM/yy', { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase()); }
  catch { return ym; }
};

interface EditState {
  id?: string;
  fuel_type: string;
  month: string; // YYYY-MM
  liters: string;
}

export function FuelControlCard() {
  const { data: rows = [], isLoading } = useFuelUsage();
  const upsert = useUpsertFuelUsage();
  const del = useDeleteFuelUsage();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<EditState>({ fuel_type: '', month: '', liters: '' });

  // ── Matriz combustível × mês ────────────────────────────────────────────────
  const fuelTypes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.fuel_type))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [rows],
  );
  const months = useMemo(
    () => Array.from(new Set(rows.map((r) => monthKey(r.reference_month)))).sort(),
    [rows],
  );
  const byKey = useMemo(() => {
    const m = new Map<string, FuelUsageRow>();
    rows.forEach((r) => m.set(`${r.fuel_type}|${monthKey(r.reference_month)}`, r));
    return m;
  }, [rows]);

  const cell = (type: string, ym: string) => byKey.get(`${type}|${ym}`);
  const rowTotal = (type: string) => months.reduce((s, ym) => s + (Number(cell(type, ym)?.liters) || 0), 0);
  const colTotal = (ym: string) => fuelTypes.reduce((s, type) => s + (Number(cell(type, ym)?.liters) || 0), 0);
  const grandTotal = rows.reduce((s, r) => s + (Number(r.liters) || 0), 0);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const openAdd = () => {
    setForm({ fuel_type: '', month: format(new Date(), 'yyyy-MM'), liters: '' });
    setDialogOpen(true);
  };
  const openEditCell = (type: string, ym: string) => {
    const existing = cell(type, ym);
    setForm({
      id: existing?.id,
      fuel_type: type,
      month: ym,
      liters: existing ? fmtL(Number(existing.liters)) : '',
    });
    setDialogOpen(true);
  };

  const parseNum = (v: string) => {
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };
  const canSave = !!form.fuel_type.trim() && /^\d{4}-\d{2}$/.test(form.month) && !!form.liters.trim();

  const handleSave = () => {
    if (!canSave) return;
    upsert.mutate(
      { fuel_type: form.fuel_type.trim(), reference_month: `${form.month}-01`, liters: parseNum(form.liters) },
      { onSuccess: () => setDialogOpen(false) },
    );
  };
  const handleDelete = () => {
    if (!form.id) return;
    del.mutate(form.id, { onSuccess: () => setDialogOpen(false) });
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b">
        <Fuel className="h-4 w-4 text-red-600" />
        <span className="font-semibold text-sm">Controle de Combustível</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">· litros por tipo e mês</span>
        <Button size="sm" variant="outline" className="ml-auto gap-1.5 h-8" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>

      <div className="p-4">
        <p className="text-xs text-muted-foreground mb-3">
          Registro à parte dos atendimentos — apenas para controle interno da secretaria dos combustíveis
          utilizados e suas quantidades. Clique numa célula para editar/remover.
        </p>

        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <Fuel className="h-10 w-10 opacity-30" />
            <p className="text-sm">Nenhum combustível registrado</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" /> Adicionar o primeiro
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left font-medium py-2 pr-3 sticky left-0 bg-card">Combustível</th>
                  {months.map((ym) => (
                    <th key={ym} className="text-right font-medium py-2 px-3 whitespace-nowrap">{monthLabel(ym)}</th>
                  ))}
                  <th className="text-right font-semibold py-2 pl-3 whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody>
                {fuelTypes.map((type) => (
                  <tr key={type} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-3 font-medium whitespace-nowrap sticky left-0 bg-card">{type}</td>
                    {months.map((ym) => {
                      const c = cell(type, ym);
                      const val = Number(c?.liters) || 0;
                      return (
                        <td key={ym} className="text-right py-1 px-3">
                          <button
                            type="button"
                            onClick={() => openEditCell(type, ym)}
                            className="tabular-nums hover:underline decoration-dotted underline-offset-2 disabled:no-underline"
                            title="Editar"
                          >
                            {val > 0 ? fmtL(val) : <span className="text-muted-foreground/40">—</span>}
                          </button>
                        </td>
                      );
                    })}
                    <td className="text-right py-2 pl-3 font-semibold tabular-nums whitespace-nowrap">{fmtL(rowTotal(type))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td className="py-2 pr-3 font-semibold sticky left-0 bg-card">Total</td>
                  {months.map((ym) => (
                    <td key={ym} className="text-right py-2 px-3 font-semibold tabular-nums whitespace-nowrap">{fmtL(colTotal(ym))}</td>
                  ))}
                  <td className="text-right py-2 pl-3 font-black tabular-nums text-red-700 whitespace-nowrap">{fmtL(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
            <p className="text-[11px] text-muted-foreground mt-2">Valores em litros (L).</p>
          </div>
        )}
      </div>

      {/* Adicionar / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar combustível' : 'Adicionar combustível'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="fuel-type">Tipo de combustível *</Label>
              <Input
                id="fuel-type"
                list="fuel-types-list"
                value={form.fuel_type}
                onChange={(e) => setForm((f) => ({ ...f, fuel_type: e.target.value }))}
                placeholder="Ex.: Gasolina, Diesel S10..."
              />
              <datalist id="fuel-types-list">
                {KNOWN_FUELS.map((f) => <option key={f} value={f} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fuel-month">Mês *</Label>
                <Input
                  id="fuel-month"
                  type="month"
                  value={form.month}
                  onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fuel-liters">Quantidade (L) *</Label>
                <Input
                  id="fuel-liters"
                  value={form.liters}
                  onChange={(e) => setForm((f) => ({ ...f, liters: e.target.value }))}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {form.id ? (
              <Button variant="ghost" className="text-destructive hover:text-destructive gap-1.5" onClick={handleDelete} disabled={del.isPending}>
                <Trash2 className="h-4 w-4" /> Remover
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!canSave || upsert.isPending}>Salvar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
