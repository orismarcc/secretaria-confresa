import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowRight, Users, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import {
  useServices, useSettlements, useGlebas, useDemandTypes,
  useReassignServicesOperator, useUnassignedServices,
} from '@/hooks/useSupabaseData';
import { useOperators } from '@/hooks/useOperatorData';

interface ReassignOperatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NONE = '__none__';
/** Origem especial: atendimentos sem nenhum operador cadastrado. */
const UNASSIGNED = '__unassigned__';

const fmtDate = (v?: string | null) => {
  if (!v) return '—';
  const d = new Date(String(v).length <= 10 ? `${v}T12:00:00` : String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? '—' : format(d, 'dd/MM/yyyy');
};

/**
 * Reatribui em massa o operador dos atendimentos:
 *  • de um operador de origem para outro (por assentamento e, opcionalmente,
 *    gleba e tipo de serviço); ou
 *  • atendimentos SEM operador → um operador (assentamento opcional, tipo de
 *    serviço opcional), escolhendo quais atendimentos específicos entram.
 * Mostra a prévia antes de confirmar. Altera dados já cadastrados (inclusive
 * finalizados) — por isso a confirmação explícita.
 */
export function ReassignOperatorDialog({ open, onOpenChange }: ReassignOperatorDialogProps) {
  const [fromOp, setFromOp] = useState('');
  const isUnassigned = fromOp === UNASSIGNED;

  const { data: services = [] } = useServices();
  const { data: operators = [] } = useOperators();
  const { data: settlements = [] } = useSettlements();
  const { data: glebas = [] } = useGlebas();
  const { data: demandTypes = [] } = useDemandTypes();
  const reassign = useReassignServicesOperator();

  const [settlementId, setSettlementId] = useState('');
  const [glebaId, setGlebaId] = useState(NONE);
  const [demandTypeId, setDemandTypeId] = useState(NONE);
  const [toOp, setToOp] = useState('');
  // Situação: 'active' (cadastrados, ainda não finalizados) OU 'completed'
  // (finalizados). Nunca os dois juntos — um ou outro.
  const [scope, setScope] = useState<'active' | 'completed'>('active');
  const [confirming, setConfirming] = useState(false);
  // Modo "sem operador": atendimentos escolhidos individualmente.
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: unassigned = [], isLoading: unassignedLoading } = useUnassignedServices(scope, open && isUnassigned);

  // Glebas do assentamento escolhido.
  const settlementGlebas = useMemo(
    () => (glebas as any[]).filter((g) => g.settlement_id === settlementId),
    [glebas, settlementId],
  );

  const activeDemandTypes = useMemo(
    () => (demandTypes as any[]).filter((d) => d.is_active !== false && d.category !== 'entregas'),
    [demandTypes],
  );

  // Atendimentos que casam com os filtros escolhidos.
  const matched = useMemo(() => {
    if (!fromOp) return [] as any[];
    // Operador → operador: assentamento continua obrigatório (como antes).
    if (!isUnassigned && !settlementId) return [] as any[];
    const base = isUnassigned ? (unassigned as any[]) : (services as any[]);
    return base.filter((s) => {
      if (!isUnassigned && s.operator_id !== fromOp) return false;
      if (settlementId && s.settlement_id !== settlementId) return false;
      if (settlementId && glebaId !== NONE && s.producers?.gleba_id !== glebaId) return false;
      if (demandTypeId !== NONE && s.demand_type_id !== demandTypeId) return false;
      if (isUnassigned) return true; // situação já filtrada no servidor
      // Situação: um OU outro, nunca ambos.
      if (scope === 'completed') return s.status === 'completed';
      return s.status !== 'completed' && s.status !== 'cancelled';
    });
  }, [services, unassigned, fromOp, isUnassigned, settlementId, glebaId, demandTypeId, scope]);

  // Ao mudar os filtros do modo "sem operador", todos os encontrados vêm marcados.
  // Depende do CONJUNTO de ids (não da referência), para um refetch em segundo
  // plano não desfazer a seleção do usuário.
  const matchedKey = matched.map((s) => s.id).join(',');
  useEffect(() => {
    if (isUnassigned) setSelected(new Set(matchedKey ? matchedKey.split(',') : []));
  }, [isUnassigned, matchedKey]);

  const targetIds = isUnassigned ? matched.filter((s) => selected.has(s.id)).map((s) => s.id) : matched.map((s) => s.id);

  const opName = (id: string) => (operators as any[]).find((o) => o.id === id)?.name || '—';
  const canPreview = !!fromOp && !!toOp && fromOp !== toOp && (isUnassigned || !!settlementId);

  const reset = () => {
    setFromOp(''); setSettlementId(''); setGlebaId(NONE); setDemandTypeId(NONE);
    setToOp(''); setScope('active'); setConfirming(false); setSelected(new Set());
  };
  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const toggle = (id: string, on: boolean) => {
    setConfirming(false);
    setSelected((prev) => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n; });
  };
  const allChecked = matched.length > 0 && matched.every((s) => selected.has(s.id));

  const doReassign = async () => {
    await reassign.mutateAsync({ serviceIds: targetIds, toOperatorId: toOp });
    close(false);
  };

  const scopeLabel = scope === 'completed' ? 'finalizados' : 'cadastrados';

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Reatribuir operador
          </DialogTitle>
          <DialogDescription>
            Move atendimentos de um operador para outro, ou atribui um operador a atendimentos
            que estão <strong>sem operador</strong>. Escolha a situação — <strong>cadastrados</strong> ou{' '}
            <strong>finalizados</strong> — para não misturar quem fez os já concluídos com quem assume os em aberto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Operador de origem</Label>
            <Select value={fromOp} onValueChange={(v) => { setFromOp(v); setConfirming(false); }}>
              <SelectTrigger><SelectValue placeholder="Quem está hoje nos atendimentos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Sem operador (não atribuídos)</SelectItem>
                {(operators as any[]).map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Situação dos atendimentos</Label>
            <Select value={scope} onValueChange={(v) => { setScope(v as 'active' | 'completed'); setConfirming(false); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Cadastrados (ainda não finalizados)</SelectItem>
                <SelectItem value="completed">Finalizados</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Só um dos dois: finalizados e cadastrados podem ter operadores diferentes.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assentamento{isUnassigned ? ' (opcional)' : ''}</Label>
              <Select
                value={settlementId || (isUnassigned ? NONE : '')}
                onValueChange={(v) => { setSettlementId(v === NONE ? '' : v); setGlebaId(NONE); setConfirming(false); }}
              >
                <SelectTrigger><SelectValue placeholder="Assentamento" /></SelectTrigger>
                <SelectContent>
                  {isUnassigned && <SelectItem value={NONE}>Todos os assentamentos</SelectItem>}
                  {(settlements as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Gleba (opcional)</Label>
              <Select value={glebaId} onValueChange={(v) => { setGlebaId(v); setConfirming(false); }} disabled={settlementGlebas.length === 0}>
                <SelectTrigger><SelectValue placeholder={settlementGlebas.length === 0 ? 'Sem glebas' : 'Todas as glebas'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Todas as glebas</SelectItem>
                  {settlementGlebas.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de serviço (opcional)</Label>
            <Select value={demandTypeId} onValueChange={(v) => { setDemandTypeId(v); setConfirming(false); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Todos os tipos</SelectItem>
                {activeDemandTypes.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Operador de destino</Label>
            <Select value={toOp} onValueChange={(v) => { setToOp(v); setConfirming(false); }}>
              <SelectTrigger><SelectValue placeholder="Para quem vão os atendimentos" /></SelectTrigger>
              <SelectContent>
                {(operators as any[]).filter((o) => o.id !== fromOp).map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Sem operador: escolha dos atendimentos específicos */}
          {isUnassigned && (
            <div className="rounded-lg border">
              <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <Checkbox
                    checked={allChecked}
                    disabled={matched.length === 0}
                    onCheckedChange={(c) => { setConfirming(false); setSelected(c ? new Set(matched.map((s) => s.id)) : new Set()); }}
                  />
                  Atendimentos sem operador
                </label>
                <span className="text-xs text-muted-foreground">{targetIds.length} de {matched.length} selecionado(s)</span>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y">
                {unassignedLoading ? (
                  <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : matched.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum atendimento {scopeLabel} sem operador com esses filtros.</p>
                ) : matched.map((s) => (
                  <label key={s.id} className="flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                    <Checkbox className="mt-0.5" checked={selected.has(s.id)} onCheckedChange={(c) => toggle(s.id, !!c)} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{s.producers?.name || 'Produtor'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.demand_types?.name || 'Serviço'} · {s.settlements?.name || 'Sem assentamento'}
                        {' · '}{scope === 'completed' ? `finalizado ${fmtDate(s.completed_at)}` : `cadastro ${fmtDate(s.scheduled_date)}`}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Prévia */}
          {canPreview && (
            <div className="rounded-lg border p-3 bg-muted/40 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{isUnassigned ? 'Sem operador' : opName(fromOp)}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-primary">{opName(toOp)}</span>
              </div>
              <p className="mt-1.5 text-muted-foreground">
                <span className="text-2xl font-bold text-foreground">{targetIds.length}</span> atendimento(s)
                {' '}<strong>{scopeLabel}</strong> serão {isUnassigned ? 'atribuídos' : 'reatribuídos'}
                {glebaId !== NONE ? ' (gleba selecionada)' : ''}
                {demandTypeId !== NONE ? ' (tipo de serviço selecionado)' : ''}.
              </p>
            </div>
          )}

          {confirming && targetIds.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-400/50 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Isso altera o operador nos atendimentos <strong>{scopeLabel}</strong> selecionados.
                {isUnassigned
                  ? ' Para desfazer, edite o operador desses atendimentos.'
                  : ' A ação é reversível refazendo a reatribuição no sentido contrário.'}
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => close(false)}>Cancelar</Button>
            {!confirming ? (
              <Button disabled={!canPreview || targetIds.length === 0} onClick={() => setConfirming(true)}>
                {isUnassigned ? 'Atribuir' : 'Reatribuir'} {canPreview ? targetIds.length : ''}
              </Button>
            ) : (
              <Button onClick={doReassign} disabled={reassign.isPending} className="bg-primary">
                {reassign.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar {isUnassigned ? 'atribuição' : 'reatribuição'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
