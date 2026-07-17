import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, History, PlusCircle, PencilLine, Trash2, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getUserColorClass } from '@/lib/userColors';
import { getStatusLabel } from '@/components/StatusBadge';
import { useAuditLog, useProfilesMap, AUDIT_PAGE_SIZE, type AuditRow } from '@/hooks/useAuditLog';
import { useProducers } from '@/hooks/useSupabaseData';

// ─── Rótulos amigáveis ─────────────────────────────────────────────────────────

const TABLE_LABEL: Record<string, string> = {
  services: 'Atendimento',
  deliveries: 'Entrega',
  patrimony: 'Patrimônio',
  producers: 'Produtor',
};

const ACTION_CFG: Record<string, { label: string; icon: any; cls: string }> = {
  INSERT: { label: 'Criou',   icon: PlusCircle, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  UPDATE: { label: 'Alterou', icon: PencilLine, cls: 'text-blue-700 bg-blue-50 border-blue-200' },
  DELETE: { label: 'Excluiu', icon: Trash2,     cls: 'text-red-700 bg-red-50 border-red-200' },
};

const FIELD_LABEL: Record<string, string> = {
  status: 'Status', completed_at: 'Data de finalização', scheduled_date: 'Data agendada',
  appointment_date: 'Data do compromisso', cancellation_reason: 'Motivo do cancelamento',
  purpose: 'Finalidade', notes: 'Observações', priority: 'Prioridade', worked_area: 'Área trabalhada',
  fuel_liters: 'Combustível (L)', worked_hours: 'Horas trabalhadas', operator_id: 'Operador',
  machinery_id: 'Maquinário', demand_type_id: 'Tipo de demanda', settlement_id: 'Assentamento',
  dam_issued: 'DAM emitida', dam_paid: 'DAM paga', dam_issued_at: 'DAM emitida em', dam_paid_at: 'DAM paga em',
  limestone_quantity: 'Qtd. calcário', input_quantity: 'Qtd. insumo', quantity: 'Quantidade',
  name: 'Nome', phone: 'Telefone', value: 'Valor', condition: 'Estado de conservação',
  written_off: 'Baixa', location: 'Localização', responsible_name: 'Responsável',
  patrimony_number: 'Nº patrimônio', category: 'Categoria', caf: 'CAF', location_name: 'Localidade',
};

const STATUS_KEYS = new Set(['status']);

function fieldLabel(k: string): string {
  return FIELD_LABEL[k] ?? k;
}

function formatValue(key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (STATUS_KEYS.has(key) && typeof v === 'string') return getStatusLabel(v);
  if (typeof v === 'string') {
    // datas / timestamps ISO
    const m = /^(\d{4}-\d{2}-\d{2})([ T]\d{2}:\d{2})?/.exec(v);
    if (m) {
      try {
        const d = parseISO(v.replace(' ', 'T'));
        return format(d, m[2] ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy', { locale: ptBR });
      } catch { /* cai no texto abaixo */ }
    }
    // ids longos (uuid) — não são legíveis; encurta
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(v)) return v.slice(0, 8) + '…';
    return v;
  }
  if (typeof v === 'number') return String(v);
  return JSON.stringify(v);
}

// ─── Página ─────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [table, setTable] = useState('all');
  const [action, setAction] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useAuditLog({ table, action, page });
  const { data: profiles } = useProfilesMap();
  const { data: producers = [] } = useProducers();

  const producerName = useMemo(() => {
    const m = new Map<string, string>();
    (producers as any[]).forEach((p) => m.set(p.id, p.name));
    return m;
  }, [producers]);

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const resetPage = () => setPage(1);

  const recordIdentity = (r: AuditRow): string => {
    const d = (r.new_data || r.old_data || {}) as Record<string, any>;
    if (r.table_name === 'producers' || r.table_name === 'patrimony') {
      return d.name || (r.record_id ? r.record_id.slice(0, 8) + '…' : '—');
    }
    // services / deliveries → nome do produtor
    if (d.producer_id && producerName.get(d.producer_id)) return producerName.get(d.producer_id)!;
    return r.record_id ? r.record_id.slice(0, 8) + '…' : '—';
  };

  return (
    <AppLayout>
      <PageHeader title="Auditoria" description="Histórico de alterações do sistema — quem alterou o quê e quando" />

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Módulo</Label>
          <Select value={table} onValueChange={(v) => { setTable(v); resetPage(); }}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="services">Atendimentos</SelectItem>
              <SelectItem value="deliveries">Entregas</SelectItem>
              <SelectItem value="patrimony">Patrimônio</SelectItem>
              <SelectItem value="producers">Produtores</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ação</Label>
          <Select value={action} onValueChange={(v) => { setAction(v); resetPage(); }}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="INSERT">Criação</SelectItem>
              <SelectItem value="UPDATE">Alteração</SelectItem>
              <SelectItem value="DELETE">Exclusão</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm text-muted-foreground ml-auto">
          {total} registro(s){isFetching && !isLoading ? ' · atualizando…' : ''}
        </span>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <History className="h-12 w-12 opacity-30" />
          <p>Nenhum registro de auditoria encontrado</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const cfg = ACTION_CFG[r.action] ?? ACTION_CFG.UPDATE;
            const ActionIcon = cfg.icon;
            const who = r.actor_id ? (profiles?.get(r.actor_id) ?? 'Usuário') : 'Sistema';
            const when = (() => { try { return format(parseISO(r.changed_at.replace(' ', 'T')), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); } catch { return r.changed_at; } })();
            const changed = (r.changed_fields ?? []).filter((k) => k !== 'updated_at' && k !== 'position');

            return (
              <div key={r.id} className="rounded-xl border bg-card p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border', cfg.cls)}>
                      <ActionIcon className="h-3.5 w-3.5" />
                      {cfg.label}
                    </span>
                    <span className="text-sm font-medium">{TABLE_LABEL[r.table_name] ?? r.table_name}</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="text-sm text-muted-foreground truncate">{recordIdentity(r)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span className={cn('font-medium', getUserColorClass(who))}>{who}</span>
                    </span>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="text-muted-foreground">{when}</span>
                  </div>
                </div>

                {/* Detalhe das alterações */}
                {r.action === 'UPDATE' && changed.length > 0 && (
                  <div className="mt-2.5 grid gap-1">
                    {changed.map((k) => (
                      <div key={k} className="text-xs flex flex-wrap items-baseline gap-1.5">
                        <span className="font-medium text-foreground/80 min-w-[120px]">{fieldLabel(k)}:</span>
                        <span className="text-muted-foreground line-through decoration-red-400/60">
                          {formatValue(k, (r.old_data as any)?.[k])}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-foreground font-medium">
                          {formatValue(k, (r.new_data as any)?.[k])}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {r.action === 'INSERT' && (
                  <p className="mt-2 text-xs text-muted-foreground">Registro criado.</p>
                )}
                {r.action === 'DELETE' && (
                  <p className="mt-2 text-xs text-muted-foreground">Registro excluído.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-muted-foreground">Página {safePage} de {totalPages}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
