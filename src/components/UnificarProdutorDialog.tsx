// Unificar dois cadastros do mesmo produtor. Tudo do cadastro repetido
// (atendimentos, entregas, propriedades, tipos de demanda, vínculo com o
// Conecta Confresa) passa para o principal; campos vazios do principal são
// preenchidos; o repetido é removido. Há "Desfazer" (backup completo no banco).
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToastAction } from '@/components/ui/toast';
import { Merge, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { textIncludes } from '@/lib/text';
import { useToast } from '@/hooks/use-toast';
import {
  useProducers, useProdutoresParecidos, useUnificarProdutores, useDesfazerUnificacao,
} from '@/hooks/useSupabaseData';

interface Atual { id: string; name: string; cpf?: string | null; phone?: string | null; settlementId?: string | null }

export function UnificarProdutorDialog({ open, onOpenChange, atual, onUnificado }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  atual: Atual;
  /** Chamado após unificar, com o id do cadastro que ficou. */
  onUnificado?: (manterId: string) => void;
}) {
  const { toast } = useToast();
  const { data: producers = [] } = useProducers();
  const { data: sugestoes = [] } = useProdutoresParecidos(
    { nome: atual.name, cpf: atual.cpf || undefined, telefone: atual.phone || undefined, settlementId: atual.settlementId || undefined, ignorarId: atual.id },
    open,
  );
  const unificar = useUnificarProdutores();
  const desfazer = useDesfazerUnificacao();

  const [busca, setBusca] = useState('');
  const [outroId, setOutroId] = useState<string | null>(null);
  const [manterAtual, setManterAtual] = useState(true);

  const outro = producers.find((p: any) => p.id === outroId) as any;
  const candidatos = useMemo(() => {
    if (!busca.trim()) return [];
    return (producers as any[])
      .filter((p) => p.id !== atual.id && (textIncludes(p.name, busca) || (p.cpf || '').replace(/\D/g, '').includes(busca.replace(/\D/g, '') || '§')))
      .slice(0, 8);
  }, [producers, busca, atual.id]);

  const fechar = (o: boolean) => {
    if (!o) { setBusca(''); setOutroId(null); setManterAtual(true); }
    onOpenChange(o);
  };

  const confirmar = async () => {
    if (!outro) return;
    const manter = manterAtual ? atual.id : outro.id;
    const remover = manterAtual ? outro.id : atual.id;
    const nomeRemovido = manterAtual ? outro.name : atual.name;
    const r = await unificar.mutateAsync({ manter, remover });
    fechar(false);
    onUnificado?.(manter);
    toast({
      title: 'Cadastros unificados',
      description: `"${nomeRemovido}" foi incorporado: ${r.atendimentos} atendimento(s), ${r.entregas} entrega(s), ${r.propriedades} propriedade(s)${r.fornecedor ? ', vínculo do Conecta Confresa' : ''}.`,
      action: (
        <ToastAction altText="Desfazer unificação" onClick={() => desfazer.mutate(r.backup_id)}>Desfazer</ToastAction>
      ),
      duration: 15000,
    });
  };

  const Opcao = ({ p, principal, onClick }: { p: { name: string; cpf?: string | null }; principal: boolean; onClick: () => void }) => (
    <button type="button" onClick={onClick}
      className={cn('flex-1 rounded-md border p-2.5 text-left text-sm', principal ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'opacity-70 hover:opacity-100')}>
      <p className="text-[10px] font-semibold uppercase tracking-wide">{principal ? 'Fica (principal)' : 'Será incorporado'}</p>
      <p className="font-medium truncate">{p.name}</p>
      <p className="text-[11px] text-muted-foreground font-mono">{p.cpf || 'sem CPF'}</p>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Merge className="h-5 w-5" /> Unificar cadastros</DialogTitle>
          <DialogDescription>
            Use quando a mesma pessoa foi cadastrada duas vezes. Tudo do cadastro repetido passa para o principal. Dá para desfazer.
          </DialogDescription>
        </DialogHeader>

        {!outro ? (
          <div className="space-y-3">
            {sugestoes.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Possivelmente a mesma pessoa</p>
                {sugestoes.map((s) => (
                  <button key={s.id} type="button" onClick={() => setOutroId(s.id)}
                    className="w-full rounded-md border p-2 text-left text-sm hover:bg-muted">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.settlement_name ? ` — ${s.settlement_name}` : ''} ({s.motivo})</span>
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Ou procure o outro cadastro</p>
              <Input placeholder="Nome ou CPF…" value={busca} onChange={(e) => setBusca(e.target.value)} />
              {candidatos.map((p: any) => (
                <button key={p.id} type="button" onClick={() => setOutroId(p.id)}
                  className="w-full rounded-md border p-2 text-left text-sm hover:bg-muted">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.settlements?.name ? ` — ${p.settlements.name}` : ''}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Toque no cadastro que deve FICAR:</p>
            <div className="flex items-stretch gap-2">
              <Opcao p={atual} principal={manterAtual} onClick={() => setManterAtual(true)} />
              <ArrowRight className={cn('h-4 w-4 self-center shrink-0 text-muted-foreground', manterAtual && 'rotate-180')} />
              <Opcao p={outro} principal={!manterAtual} onClick={() => setManterAtual(false)} />
            </div>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              <li>Atendimentos, entregas, propriedades e tipos de demanda passam para o principal.</li>
              <li>Dados vazios do principal (telefone, localização, CAF…) são preenchidos; nada é sobrescrito.</li>
              <li>O cadastro incorporado é removido — e pode ser restaurado com "Desfazer".</li>
            </ul>
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setOutroId(null)}>Voltar</Button>
              <Button onClick={confirmar} disabled={unificar.isPending}>
                {unificar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Merge className="h-4 w-4 mr-2" />}
                Unificar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
