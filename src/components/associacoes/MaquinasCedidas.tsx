// Maquinário das Frotas cedido à associação: termo de cessão, devolução e o
// uso de cada máquina (horas / área dos atendimentos da associação).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Eye, Loader2, Paperclip, Pencil, Plus, Tractor, Trash2, Undo2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useMachinery } from '@/hooks/useSupabaseData';
import { abrirArquivoAssociacao, useExcluirCessao, useSalvarCessao } from '@/hooks/useAssociacoes';
import { Ajuda, dataBR, fmtNum, hojeISO, selectCls } from './comum';
import { calcularMetricas, problemaArquivo, type AtendimentoAssociacao, type Cessao } from '@/lib/associacoes';

type Maquina = { id: string; name: string; patrimony_number?: string | null; is_active?: boolean | null };
const nomeMaquina = (m?: Maquina) => (m ? `${m.name}${m.patrimony_number ? ` (${m.patrimony_number})` : ''}` : 'Máquina removida');

function CessaoDialog({ aberto, associacaoId, cessao, maquinas, ocupadas, onClose }: {
  aberto: boolean; associacaoId: string; cessao: Cessao | null; maquinas: Maquina[]; ocupadas: Set<string>; onClose: () => void;
}) {
  const { toast } = useToast();
  const salvar = useSalvarCessao();
  const inputRef = useRef<HTMLInputElement>(null);
  const [maquina, setMaquina] = useState('');
  const [data, setData] = useState('');
  const [obs, setObs] = useState('');
  const [termo, setTermo] = useState<File | null>(null);
  useEffect(() => {
    if (!aberto) return;
    setMaquina(cessao?.machinery_id ?? ''); setData(cessao?.data_cessao ?? hojeISO()); setObs(cessao?.observacao ?? ''); setTermo(null);
  }, [aberto, cessao?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const disponiveis = maquinas.filter((m) => (m.is_active !== false && !ocupadas.has(m.id)) || m.id === cessao?.machinery_id);
  const gravar = async () => {
    try {
      await salvar.mutateAsync({
        id: cessao?.id, termo, termoAnterior: cessao?.termo_path ?? null,
        dados: { associacao_id: associacaoId, machinery_id: maquina, data_cessao: data, data_devolucao: cessao?.data_devolucao ?? null, observacao: obs.trim() || null },
      });
      onClose();
    } catch { /* aviso */ }
  };
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o && !salvar.isPending) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tractor className="h-5 w-5 text-primary" /> {cessao ? 'Editar cessão' : 'Ceder maquinário'}</DialogTitle>
          <DialogDescription>A máquina continua cadastrada em Frotas; aqui fica registrado que está com a associação.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cs-maq">Máquina / implemento *</Label>
            <select id="cs-maq" value={maquina} onChange={(e) => setMaquina(e.target.value)} className={selectCls} disabled={!!cessao}>
              <option value="">Selecione…</option>
              {disponiveis.map((m) => <option key={m.id} value={m.id}>{nomeMaquina(m)}</option>)}
            </select>
            {!cessao && <p className="text-xs text-muted-foreground">Só aparecem as máquinas ativas que não estão cedidas a outra associação.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs-data">Data da cessão *</Label>
            <Input id="cs-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Termo de cessão (PDF/foto)</Label>
            <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const er = problemaArquivo(f); if (er) toast({ title: er, variant: 'destructive' }); else setTermo(f); }} />
            {termo ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                <span className="truncate text-sm">{termo.name}</span>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setTermo(null)} aria-label="Remover"><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => inputRef.current?.click()}>
                <Paperclip className="h-4 w-4 mr-2" /> {cessao?.termo_nome ? `Trocar termo (${cessao.termo_nome})` : 'Anexar termo'}
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs-obs">Observação</Label>
            <Textarea id="cs-obs" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: estado de conservação na entrega" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={salvar.isPending}>Cancelar</Button>
          <Button onClick={gravar} disabled={!maquina || !data || salvar.isPending}>
            {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{cessao ? 'Salvar' : 'Registrar cessão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MaquinasCedidas({ associacaoId, cessoes, todasCessoes, atendimentos }: {
  associacaoId: string;
  cessoes: Cessao[];          // desta associação
  todasCessoes: Cessao[];     // de todas (para saber quais estão ocupadas)
  atendimentos: AtendimentoAssociacao[]; // desta associação
}) {
  const { toast } = useToast();
  const { canDelete } = useAuth();
  const { data: maquinasRaw = [] } = useMachinery();
  const maquinas = maquinasRaw as Maquina[];
  const salvar = useSalvarCessao();
  const excluir = useExcluirCessao();
  const [editando, setEditando] = useState<Cessao | null | undefined>(undefined);
  const [devolvendo, setDevolvendo] = useState<Cessao | null>(null);
  const [dataDevolucao, setDataDevolucao] = useState(hojeISO());
  const [aExcluir, setAExcluir] = useState<Cessao | null>(null);

  const ocupadas = useMemo(() => new Set(todasCessoes.filter((c) => !c.data_devolucao).map((c) => c.machinery_id)), [todasCessoes]);
  const uso = useMemo(() => new Map(calcularMetricas(atendimentos).porMaquina.map((m) => [m.chave, m])), [atendimentos]);
  const ativas = cessoes.filter((c) => !c.data_devolucao);
  const devolvidas = cessoes.filter((c) => c.data_devolucao);

  const Linha = ({ c }: { c: Cessao }) => {
    const m = maquinas.find((x) => x.id === c.machinery_id);
    const u = uso.get(c.machinery_id);
    return (
      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0"><Tractor className="h-5 w-5 text-primary" /></div>
            <div className="min-w-0">
              <p className="font-medium truncate">{nomeMaquina(m)}</p>
              <p className="text-xs text-muted-foreground">
                Cedida em {dataBR(c.data_cessao)}{c.data_devolucao ? ` · devolvida em ${dataBR(c.data_devolucao)}` : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                Uso registrado: <strong className="text-foreground">{fmtNum(u?.horas ?? 0)} h</strong> · {fmtNum(u?.area ?? 0)} ha · {u?.atendimentos ?? 0} atendimento(s)
              </p>
              {c.observacao && <p className="text-xs italic text-muted-foreground">{c.observacao}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 shrink-0">
            {c.termo_path && <Button size="sm" variant="outline" className="gap-1" onClick={() => abrirArquivoAssociacao(c.termo_path!).catch((e) => toast({ title: 'Erro ao abrir', description: e.message, variant: 'destructive' }))}><Eye className="h-4 w-4" /> Termo</Button>}
            {!c.data_devolucao && <Button size="sm" variant="outline" className="gap-1" onClick={() => { setDataDevolucao(hojeISO()); setDevolvendo(c); }}><Undo2 className="h-4 w-4" /> Devolução</Button>}
            <Button size="icon" variant="ghost" className="h-9 w-9" title="Editar" onClick={() => setEditando(c)}><Pencil className="h-4 w-4" /></Button>
            {canDelete && <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive hover:text-destructive" title="Excluir" onClick={() => setAExcluir(c)}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          {ativas.length} máquina(s) com a associação
          <Ajuda titulo="Maquinário cedido">Registre aqui as máquinas e implementos das Frotas entregues à associação (com o termo). O uso é medido pelos atendimentos que a associação lança na aba Atendimentos.</Ajuda>
        </p>
        <Button size="sm" onClick={() => setEditando(null)} className="gap-1.5"><Plus className="h-4 w-4" /> Ceder máquina</Button>
      </div>
      {ativas.length === 0 && devolvidas.length === 0 && (
        <Card><CardContent className="py-8 text-center space-y-2">
          <Tractor className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma máquina cedida a esta associação.</p>
        </CardContent></Card>
      )}
      {ativas.map((c) => <Linha key={c.id} c={c} />)}
      {devolvidas.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">Histórico (devolvidas)</p>
          {devolvidas.map((c) => <Linha key={c.id} c={c} />)}
        </div>
      )}

      <CessaoDialog aberto={editando !== undefined} associacaoId={associacaoId} cessao={editando ?? null} maquinas={maquinas} ocupadas={ocupadas} onClose={() => setEditando(undefined)} />

      <Dialog open={!!devolvendo} onOpenChange={(o) => { if (!o) setDevolvendo(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar devolução</DialogTitle>
            <DialogDescription>A máquina volta a ficar disponível para ceder a outra associação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="dv-data">Data da devolução</Label>
            <Input id="dv-data" type="date" value={dataDevolucao} min={devolvendo?.data_cessao} onChange={(e) => setDataDevolucao(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDevolvendo(null)}>Cancelar</Button>
            <Button disabled={!dataDevolucao || salvar.isPending || (!!devolvendo && dataDevolucao < devolvendo.data_cessao)} onClick={async () => {
              if (!devolvendo) return;
              try {
                await salvar.mutateAsync({ id: devolvendo.id, dados: { associacao_id: associacaoId, machinery_id: devolvendo.machinery_id, data_cessao: devolvendo.data_cessao, data_devolucao: dataDevolucao, observacao: devolvendo.observacao } });
                setDevolvendo(null);
              } catch { /* aviso */ }
            }}>Confirmar devolução</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!aExcluir}
        onOpenChange={(o) => { if (!o) setAExcluir(null); }}
        title="Excluir o registro da cessão?"
        description="Use apenas para corrigir um lançamento errado. Para quando a máquina voltar, use &quot;Devolução&quot; (mantém o histórico)."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => { if (aExcluir) excluir.mutate(aExcluir); setAExcluir(null); }}
      />
    </div>
  );
}
