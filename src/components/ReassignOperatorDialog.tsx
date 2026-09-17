import { useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowRight, Users, Loader2, AlertTriangle } from 'lucide-react';
import { useServices, useSettlements, useGlebas, useReassignServicesOperator } from '@/hooks/useSupabaseData';
import { useOperators } from '@/hooks/useOperatorData';

interface ReassignOperatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NONE = '__none__';

/**
 * Reatribui em massa o operador dos atendimentos de um assentamento (e, se
 * quiser, uma gleba) — de um operador de origem para outro de destino.
 * Mostra a prévia de quantos serão afetados antes de confirmar. Altera dados
 * já cadastrados (inclusive finalizados) — por isso a confirmação explícita.
 */
export function ReassignOperatorDialog({ open, onOpenChange }: ReassignOperatorDialogProps) {
  const { data: services = [] } = useServices();
  const { data: operators = [] } = useOperators();
  const { data: settlements = [] } = useSettlements();
  const { data: glebas = [] } = useGlebas();
  const reassign = useReassignServicesOperator();

  const [fromOp, setFromOp] = useState('');
  const [settlementId, setSettlementId] = useState('');
  const [glebaId, setGlebaId] = useState(NONE);
  const [toOp, setToOp] = useState('');
  // Situação: 'active' (cadastrados, ainda não finalizados) OU 'completed'
  // (finalizados). Nunca os dois juntos — um ou outro.
  const [scope, setScope] = useState<'active' | 'completed'>('active');
  const [confirming, setConfirming] = useState(false);

  // Glebas do assentamento escolhido.
  const settlementGlebas = useMemo(
    () => (glebas as any[]).filter((g) => g.settlement_id === settlementId),
    [glebas, settlementId],
  );

  // Atendimentos que casam com os filtros escolhidos.
  const matched = useMemo(() => {
    if (!fromOp || !settlementId) return [] as any[];
    return (services as any[]).filter((s) => {
      if (s.operator_id !== fromOp) return false;
      if (s.settlement_id !== settlementId) return false;
      if (glebaId !== NONE && s.producers?.gleba_id !== glebaId) return false;
      // Situação: um OU outro, nunca ambos.
      if (scope === 'completed') return s.status === 'completed';
      return s.status !== 'completed' && s.status !== 'cancelled';
    });
  }, [services, fromOp, settlementId, glebaId, scope]);

  const opName = (id: string) => (operators as any[]).find((o) => o.id === id)?.name || '—';
  const canPreview = !!fromOp && !!settlementId && !!toOp && fromOp !== toOp;

  const reset = () => { setFromOp(''); setSettlementId(''); setGlebaId(NONE); setToOp(''); setScope('active'); setConfirming(false); };
  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const doReassign = async () => {
    await reassign.mutateAsync({ serviceIds: matched.map((s) => s.id), toOperatorId: toOp });
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Reatribuir operador
          </DialogTitle>
          <DialogDescription>
            Move os atendimentos de um assentamento (e gleba, opcional) de um operador para outro.
            Escolha a situação — <strong>cadastrados</strong> ou <strong>finalizados</strong> — para
            não misturar quem fez os já concluídos com quem assume os em aberto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Operador de origem</Label>
            <Select value={fromOp} onValueChange={(v) => { setFromOp(v); setConfirming(false); }}>
              <SelectTrigger><SelectValue placeholder="Quem está hoje nos atendimentos" /></SelectTrigger>
              <SelectContent>
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
              <Label>Assentamento</Label>
              <Select value={settlementId} onValueChange={(v) => { setSettlementId(v); setGlebaId(NONE); setConfirming(false); }}>
                <SelectTrigger><SelectValue placeholder="Assentamento" /></SelectTrigger>
                <SelectContent>
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
            <Label>Operador de destino</Label>
            <Select value={toOp} onValueChange={(v) => { setToOp(v); setConfirming(false); }}>
              <SelectTrigger><SelectValue placeholder="Para quem vão os atendimentos" /></SelectTrigger>
              <SelectContent>
                {(operators as any[]).filter((o) => o.id !== fromOp).map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Prévia */}
          {canPreview && (
            <div className="rounded-lg border p-3 bg-muted/40 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{opName(fromOp)}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-primary">{opName(toOp)}</span>
              </div>
              <p className="mt-1.5 text-muted-foreground">
                <span className="text-2xl font-bold text-foreground">{matched.length}</span> atendimento(s)
                {' '}<strong>{scope === 'completed' ? 'finalizados' : 'cadastrados'}</strong> serão reatribuídos
                {glebaId !== NONE ? ' (gleba selecionada)' : ''}.
              </p>
            </div>
          )}

          {confirming && matched.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-400/50 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              Isso altera o operador nos atendimentos <strong>{scope === 'completed' ? 'finalizados' : 'cadastrados'}</strong> selecionados. A ação é reversível refazendo a reatribuição no sentido contrário.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => close(false)}>Cancelar</Button>
            {!confirming ? (
              <Button disabled={!canPreview || matched.length === 0} onClick={() => setConfirming(true)}>
                Reatribuir {canPreview ? matched.length : ''}
              </Button>
            ) : (
              <Button onClick={doReassign} disabled={reassign.isPending} className="bg-primary">
                {reassign.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar reatribuição
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
