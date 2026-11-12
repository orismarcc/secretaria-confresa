// Cadastrar / editar ofício. Número sugerido = próximo do ano (o banco
// confirma e recusa duplicidade). Pode partir de um modelo e já anexar o PDF
// assinado.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { FileDown, FilePlus2, Loader2, Paperclip, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSalvarOficio } from '@/hooks/useOficios';
import { gerarDocumentoDoModelo } from './comum';
import {
  CATEGORIAS_OFICIO, SITUACOES_OFICIO, problemaPdf, proximoNumeroLocal, tamanhoLegivel,
  type Oficio, type OficioModelo, type SituacaoOficio,
} from '@/lib/oficios';

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const anoDe = (iso: string) => Number(iso.slice(0, 4)) || new Date().getFullYear();

const selectCls = 'w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

export function OficioFormDialog({ aberto, oficio, modeloInicial, oficios, modelos, onClose, onSalvo }: {
  aberto: boolean;
  /** Ofício em edição (null = novo). */
  oficio: Oficio | null;
  /** Para "Usar modelo": undefined = sem escolha; null = modelo padrão. */
  modeloInicial?: OficioModelo | null;
  oficios: Oficio[];
  modelos: OficioModelo[];
  onClose: () => void;
  onSalvo?: (o: Oficio) => void;
}) {
  const { toast } = useToast();
  const salvar = useSalvarOficio();
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState(hoje());
  const [numeroAuto, setNumeroAuto] = useState(true);
  const [numero, setNumero] = useState('');
  const [destinatario, setDestinatario] = useState('');
  const [assunto, setAssunto] = useState('');
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_OFICIO[0]);
  const [situacao, setSituacao] = useState<SituacaoOficio>('rascunho');
  const [descricao, setDescricao] = useState('');
  const [modeloId, setModeloId] = useState<string>(''); // '' nenhum · 'padrao' · id
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    if (oficio) {
      setData(oficio.data_oficio);
      setNumeroAuto(false);
      setNumero(String(oficio.numero));
      setDestinatario(oficio.destinatario);
      setAssunto(oficio.assunto);
      setCategoria(oficio.categoria);
      setSituacao(oficio.situacao);
      setDescricao(oficio.descricao ?? '');
      setModeloId(oficio.modelo_id ?? '');
    } else {
      setData(hoje());
      setNumeroAuto(true);
      setNumero('');
      setDestinatario('');
      setAssunto('');
      setCategoria(modeloInicial?.categoria ?? CATEGORIAS_OFICIO[0]);
      setSituacao('rascunho');
      setDescricao('');
      setModeloId(modeloInicial === undefined ? '' : modeloInicial === null ? 'padrao' : modeloInicial.id);
    }
    setArquivo(null);
  }, [aberto, oficio?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ano = anoDe(data);
  // Ao editar, o próprio ofício não conta como "ocupado".
  const outros = useMemo(() => oficios.filter((o) => o.id !== oficio?.id), [oficios, oficio?.id]);
  const sugerido = proximoNumeroLocal(outros, ano);
  const numeroNum = numeroAuto ? null : Number(numero);
  const duplicado = !numeroAuto && !!numeroNum && outros.some((o) => o.ano === ano && o.numero === numeroNum);
  // Editar trocando o ano da data: o número antigo pode não valer no ano novo.
  const anoMudou = !!oficio && oficio.ano !== ano;
  useEffect(() => {
    if (anoMudou && !numeroAuto && Number(numero) === oficio?.numero) setNumero(String(sugerido));
  }, [anoMudou]); // eslint-disable-line react-hooks/exhaustive-deps

  const modeloEscolhido = modeloId === 'padrao' ? null : modelos.find((m) => m.id === modeloId);
  const faltando: string[] = [];
  if (!data) faltando.push('data');
  if (!numeroAuto && !(numeroNum && numeroNum > 0)) faltando.push('número');
  if (!destinatario.trim()) faltando.push('destinatário');
  if (!assunto.trim()) faltando.push('assunto');
  const podeSalvar = faltando.length === 0 && !duplicado && !salvar.isPending;

  const escolherArquivo = (f: File | null) => {
    if (!f) return;
    const erro = problemaPdf(f);
    if (erro) { toast({ title: erro, variant: 'destructive' }); return; }
    setArquivo(f);
    if (situacao === 'rascunho') setSituacao('emitido');
  };

  const gerarDoc = async () => {
    if (modeloId === '') return;
    setGerando(true);
    try {
      const aviso = await gerarDocumentoDoModelo(modeloEscolhido ?? null, {
        numero: `${numeroAuto ? sugerido : numero}/${ano}`, data, destinatario, assunto, categoria, descricao,
      });
      toast(aviso
        ? { title: 'Documento baixado', description: aviso }
        : { title: 'Documento gerado a partir do modelo', description: numeroAuto ? `Usou o número sugerido ${sugerido}/${ano}; confira ao salvar.` : undefined });
    } catch (e) {
      toast({ title: 'Erro ao gerar o documento', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setGerando(false);
    }
  };

  const enviar = async () => {
    if (!podeSalvar) return;
    try {
      const r = await salvar.mutateAsync({
        id: oficio?.id,
        dados: {
          numero: numeroNum, data_oficio: data, destinatario: destinatario.trim(), assunto: assunto.trim(),
          categoria, situacao, descricao: descricao.trim() || null,
          modelo_id: modeloId && modeloId !== 'padrao' ? modeloId : null,
        },
        arquivo,
      });
      onSalvo?.(r.oficio);
      onClose();
    } catch { /* aviso já exibido */ }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o && !salvar.isPending) onClose(); }}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePlus2 className="h-5 w-5 text-primary" />
            {oficio ? `Editar Ofício Nº ${oficio.numero}/${oficio.ano}` : 'Novo ofício'}
          </DialogTitle>
          <DialogDescription>
            {oficio ? 'Altere os dados do ofício. O arquivo assinado é trocado nos detalhes, com histórico.' : 'Preencha os dados. O PDF assinado pode ser anexado agora ou depois.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Modelo */}
          <div className="space-y-1.5">
            <Label htmlFor="of-modelo">Modelo (opcional)</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <select id="of-modelo" value={modeloId} onChange={(e) => {
                setModeloId(e.target.value);
                const m = modelos.find((x) => x.id === e.target.value);
                if (m && !oficio) setCategoria(m.categoria);
              }} className={selectCls}>
                <option value="">Sem modelo</option>
                <option value="padrao">Modelo padrão (timbrado oficial)</option>
                {modelos.filter((m) => m.ativo || m.id === modeloId).map((m) => (
                  <option key={m.id} value={m.id}>{m.nome} — {m.categoria}</option>
                ))}
              </select>
              <Button type="button" variant="outline" onClick={gerarDoc} disabled={modeloId === '' || gerando} className="shrink-0">
                {gerando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                Gerar documento
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              "Gerar documento" baixa o modelo com número, data, destinatário e assunto preenchidos, para revisar, assinar e anexar o PDF.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="of-data">Data *</Label>
              <Input id="of-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-numero">Número *</Label>
              {numeroAuto ? (
                <div className="flex h-10 items-center justify-between rounded-md border bg-muted/40 px-3">
                  <span className="font-semibold">{sugerido}/{ano}</span>
                  <span className="text-xs text-muted-foreground">automático</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input id="of-numero" inputMode="numeric" value={numero}
                    onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    aria-invalid={duplicado} className={duplicado ? 'border-destructive' : ''} />
                  <span className="text-sm text-muted-foreground shrink-0">/{ano}</span>
                </div>
              )}
              {!oficio && (
                <label htmlFor="of-num-auto" className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox id="of-num-auto" checked={numeroAuto} onCheckedChange={(v) => {
                    setNumeroAuto(!!v);
                    if (!v) setNumero(String(sugerido));
                  }} />
                  Próximo número livre do ano
                </label>
              )}
              {duplicado && <p className="text-xs text-destructive">Já existe o Ofício Nº {numeroNum}/{ano}. Próximo livre: {sugerido}.</p>}
              {anoMudou && <p className="text-xs text-amber-700 dark:text-amber-400">O ano mudou para {ano}: confira o número.</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="of-destinatario">Destinatário *</Label>
            <Input id="of-destinatario" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder="Ex.: À Secretaria Municipal de Finanças" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="of-assunto">Assunto *</Label>
            <Input id="of-assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Ex.: Solicitação de restituição de DAM" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="of-categoria">Categoria *</Label>
              <select id="of-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className={selectCls}>
                {[...CATEGORIAS_OFICIO, ...(CATEGORIAS_OFICIO.includes(categoria as never) ? [] : [categoria])].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-situacao">Situação *</Label>
              <select id="of-situacao" value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoOficio)} className={selectCls}>
                {SITUACOES_OFICIO.map((s) => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="of-descricao">Descrição</Label>
            <Textarea id="of-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4}
              placeholder="Resumo ou texto do ofício (entra no campo {descricao} do modelo)." />
          </div>

          {!oficio && (
            <div className="space-y-1.5">
              <Label>Arquivo final assinado (PDF)</Label>
              <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden"
                onChange={(e) => { escolherArquivo(e.target.files?.[0] ?? null); e.target.value = ''; }} />
              {arquivo ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                  <span className="flex items-center gap-2 min-w-0 text-sm">
                    <Paperclip className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">{arquivo.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{tamanhoLegivel(arquivo.size)}</span>
                  </span>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setArquivo(null)} aria-label="Remover arquivo">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => inputRef.current?.click()}>
                  <Paperclip className="h-4 w-4 mr-2" /> Anexar PDF assinado
                </Button>
              )}
            </div>
          )}

          {faltando.length > 0 && <p className="text-xs text-muted-foreground">Preencha: {faltando.join(', ')}.</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={salvar.isPending}>Cancelar</Button>
          <Button onClick={enviar} disabled={!podeSalvar}>
            {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {oficio ? 'Salvar alterações' : 'Cadastrar ofício'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
