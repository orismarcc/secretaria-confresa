import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useSetSituacaoOferta, type Oferta } from './hooks';
import { PROGRAMAS, unidadeLabel, fmtNum, mesesResumo, fmtBRL } from './constants';

interface Props {
  oferta: Oferta | null;
  onOpenChange: (o: boolean) => void;
  /** Avisos sobre o fornecedor (não bloqueiam — a equipe decide). */
  avisos?: string[];
}

/** Aceitar oferta: para qual programa e quanto por mês (padrão: tudo o que foi ofertado). */
export function AceitarDialog({ oferta, onOpenChange, avisos = [] }: Props) {
  const set = useSetSituacaoOferta();
  const [programa, setPrograma] = useState('pnae');
  const [qtd, setQtd] = useState('');

  useEffect(() => {
    if (!oferta) return;
    setPrograma(oferta.programa || 'pnae');
    setQtd(oferta.qtd_aceita != null ? String(oferta.qtd_aceita) : oferta.qtd_mensal != null ? String(oferta.qtd_mensal) : '');
  }, [oferta]);

  if (!oferta) return null;
  const un = unidadeLabel(oferta.unidade);
  const n = Number(qtd.replace(',', '.'));
  const qtdValida = qtd.trim() === '' || (Number.isFinite(n) && n >= 0);
  const acimaDoOfertado = oferta.qtd_mensal != null && Number.isFinite(n) && n > Number(oferta.qtd_mensal);

  const confirmar = async () => {
    await set.mutateAsync({ id: oferta.id, situacao: 'aceita', programa, qtd_aceita: qtd.trim() === '' ? null : n });
    onOpenChange(false);
  };

  return (
    <Dialog open={!!oferta} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Aceitar oferta</DialogTitle>
          <DialogDescription>
            {oferta.vitrine_fornecedores?.nome} · {oferta.vitrine_produtos?.nome}{oferta.vitrine_variedades?.nome ? ` ${oferta.vitrine_variedades.nome}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
          Ofertado: {oferta.qtd_mensal != null ? `${fmtNum(oferta.qtd_mensal)} ${un}/mês` : 'quantidade não informada'} · {mesesResumo(oferta.meses)}
          {oferta.preco != null ? ` · ${fmtBRL(oferta.preco)}/${un}${oferta.preco_entregue ? ' entregue' : ''}` : ''}
        </div>

        {avisos.length > 0 && (
          <div className="rounded-md border border-amber-400/50 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
            {avisos.map((a) => <p key={a} className="flex items-start gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{a}</p>)}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Programa</Label>
            <Select value={programa} onValueChange={setPrograma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROGRAMAS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Quantidade aceita/mês ({un})</Label>
            <Input inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} />
          </div>
        </div>
        {acimaDoOfertado && <p className="text-xs text-amber-700">Acima do que o produtor ofertou por mês.</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirmar} disabled={set.isPending || !qtdValida} className="bg-emerald-600 hover:bg-emerald-600/90 text-white">
            {set.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Aceitar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
