// Modelos de ofícios: modelo padrão (timbrado oficial) + modelos próprios
// (.docx preserva toda a formatação; PDF também é aceito). Criar, editar,
// substituir arquivo, excluir e usar como base para um novo ofício.
import { useMemo, useRef, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchInput } from '@/components/SearchInput';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  BookTemplate, Download, FilePlus2, FileText, Info, Loader2, Paperclip, Pencil, Plus, Stamp, Trash2, X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { abrirArquivoOficio, useExcluirModelo, useSalvarModelo } from '@/hooks/useOficios';
import { triggerDownload } from '@/lib/comunicado';
import {
  CAMPOS_MODELO, CATEGORIAS_OFICIO, MODELO_PADRAO_URL, ehDocx, normalizar, problemaModelo, tamanhoLegivel,
  type Oficio, type OficioModelo,
} from '@/lib/oficios';

const selectCls = 'w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

function ModeloFormDialog({ aberto, modelo, onClose }: { aberto: boolean; modelo: OficioModelo | null; onClose: () => void }) {
  const { toast } = useToast();
  const salvar = useSalvarModelo();
  const inputRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_OFICIO[0]);
  const [finalidade, setFinalidade] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [confirmarTroca, setConfirmarTroca] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setNome(modelo?.nome ?? '');
    setCategoria(modelo?.categoria ?? CATEGORIAS_OFICIO[0]);
    setFinalidade(modelo?.finalidade ?? '');
    setDescricao(modelo?.descricao ?? '');
    setAtivo(modelo?.ativo ?? true);
    setArquivo(null);
  }, [aberto, modelo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolher = (f: File | null) => {
    if (!f) return;
    const erro = problemaModelo(f);
    if (erro) { toast({ title: erro, variant: 'destructive' }); return; }
    setArquivo(f);
  };

  const podeSalvar = nome.trim().length > 0 && (!!modelo?.arquivo_path || !!arquivo) && !salvar.isPending;
  const gravar = async () => {
    try {
      await salvar.mutateAsync({
        modelo, arquivo,
        dados: { nome: nome.trim(), categoria, finalidade: finalidade.trim() || null, descricao: descricao.trim() || null, ativo },
      });
      onClose();
    } catch { /* aviso já exibido */ }
  };

  return (
    <>
      <Dialog open={aberto} onOpenChange={(o) => { if (!o && !salvar.isPending) onClose(); }}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BookTemplate className="h-5 w-5 text-primary" /> {modelo ? 'Editar modelo' : 'Novo modelo'}</DialogTitle>
            <DialogDescription>Envie o modelo em Word (.docx) — a formatação original é preservada. Use os campos entre chaves para preenchimento automático.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="md-nome">Nome *</Label>
              <Input id="md-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Solicitação de máquinas ao Estado" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="md-cat">Categoria *</Label>
                <select id="md-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)} className={selectCls}>
                  {[...CATEGORIAS_OFICIO, ...(CATEGORIAS_OFICIO.includes(categoria as never) ? [] : [categoria])].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="md-fin">Finalidade</Label>
                <Input id="md-fin" value={finalidade} onChange={(e) => setFinalidade(e.target.value)} placeholder="Ex.: Pedido de apoio" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="md-desc">Descrição</Label>
              <Textarea id="md-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="Quando usar este modelo" />
            </div>
            <div className="space-y-1.5">
              <Label>Arquivo do modelo *</Label>
              <input ref={inputRef} type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden"
                onChange={(e) => { escolher(e.target.files?.[0] ?? null); e.target.value = ''; }} />
              {arquivo ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                  <span className="flex items-center gap-2 min-w-0 text-sm"><Paperclip className="h-4 w-4 text-primary shrink-0" /><span className="truncate">{arquivo.name}</span></span>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setArquivo(null)} aria-label="Remover"><X className="h-4 w-4" /></Button>
                </div>
              ) : modelo?.arquivo_path ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <span className="text-sm truncate">{modelo.arquivo_nome}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => setConfirmarTroca(true)}>Substituir</Button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => inputRef.current?.click()}>
                  <Paperclip className="h-4 w-4 mr-2" /> Escolher arquivo (.docx ou .pdf)
                </Button>
              )}
            </div>
            <label htmlFor="md-ativo" className="flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer">
              <span className="text-sm">Disponível para novos ofícios</span>
              <Switch id="md-ativo" checked={ativo} onCheckedChange={setAtivo} />
            </label>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose} disabled={salvar.isPending}>Cancelar</Button>
            <Button onClick={gravar} disabled={!podeSalvar}>
              {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {modelo ? 'Salvar' : 'Criar modelo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmarTroca}
        onOpenChange={setConfirmarTroca}
        title="Substituir o arquivo do modelo?"
        description="O arquivo atual do modelo será trocado pelo novo ao salvar. Ofícios já cadastrados não são afetados."
        confirmLabel="Escolher novo arquivo"
        onConfirm={() => inputRef.current?.click()}
      />
    </>
  );
}

export function ModelosOficios({ modelos, oficios, carregando, onUsar, podeCriar }: {
  modelos: OficioModelo[];
  oficios: Oficio[];
  carregando: boolean;
  /** Usar como base de um novo ofício (null = modelo padrão). */
  onUsar: (m: OficioModelo | null) => void;
  podeCriar: boolean;
}) {
  const { toast } = useToast();
  const { canDelete } = useAuth();
  const excluir = useExcluirModelo();
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [editando, setEditando] = useState<OficioModelo | null | undefined>(undefined); // undefined = fechado
  const [aExcluir, setAExcluir] = useState<OficioModelo | null>(null);
  const [verCampos, setVerCampos] = useState(false);

  const usos = useMemo(() => {
    const m = new Map<string, number>();
    oficios.forEach((o) => { if (o.modelo_id) m.set(o.modelo_id, (m.get(o.modelo_id) ?? 0) + 1); });
    return m;
  }, [oficios]);
  const filtrados = useMemo(() => modelos.filter((m) => {
    if (categoria && m.categoria !== categoria) return false;
    const t = normalizar(busca);
    return !t || [m.nome, m.finalidade, m.descricao, m.categoria].some((c) => normalizar(c).includes(t));
  }), [modelos, busca, categoria]);
  const porCategoria = useMemo(() => {
    const g = new Map<string, OficioModelo[]>();
    filtrados.forEach((m) => g.set(m.categoria, [...(g.get(m.categoria) ?? []), m]));
    return Array.from(g.entries()).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [filtrados]);

  const baixarPadrao = async () => {
    try {
      const r = await fetch(MODELO_PADRAO_URL);
      if (!r.ok) throw new Error('Modelo padrão não encontrado.');
      triggerDownload(await r.blob(), 'Modelo-Oficio-Padrao.docx');
    } catch (e) { toast({ title: 'Erro ao baixar', description: (e as Error).message, variant: 'destructive' }); }
  };
  const baixar = async (m: OficioModelo) => {
    if (!m.arquivo_path) return;
    try { await abrirArquivoOficio(m.arquivo_path, m.arquivo_nome || 'modelo'); }
    catch (e) { toast({ title: 'Erro ao baixar', description: (e as Error).message, variant: 'destructive' }); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <SearchInput value={busca} onChange={setBusca} placeholder="Pesquisar modelo por nome, finalidade ou categoria" className="flex-1" />
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={`${selectCls} sm:w-56`} aria-label="Filtrar por categoria">
              <option value="">Todas as categorias</option>
              {Array.from(new Set([...CATEGORIAS_OFICIO, ...modelos.map((m) => m.categoria)])).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {podeCriar && <Button onClick={() => setEditando(null)} className="gap-2"><Plus className="h-4 w-4" /> Novo modelo</Button>}
          </div>
          <button type="button" onClick={() => setVerCampos((v) => !v)} className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
            <Info className="h-3.5 w-3.5" /> Campos que o sistema preenche nos modelos Word
          </button>
          {verCampos && (
            <div className="grid sm:grid-cols-2 gap-1.5 rounded-lg bg-muted/40 p-3">
              {CAMPOS_MODELO.map((c) => (
                <p key={c.tag} className="text-xs"><code className="font-semibold text-primary">{c.tag}</code> — {c.descricao}</p>
              ))}
              <p className="text-xs text-muted-foreground sm:col-span-2">Escreva o campo no Word exatamente assim, com as chaves. O resto do documento (timbrado, fontes, tabelas) não é alterado.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modelo padrão */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-primary/10 shrink-0"><Stamp className="h-5 w-5 text-primary" /></div>
            <div className="min-w-0">
              <p className="font-semibold flex items-center gap-2 flex-wrap">Modelo padrão <Badge variant="secondary">Timbrado oficial</Badge></p>
              <p className="text-sm text-muted-foreground">Cabeçalho e rodapé da Prefeitura, com número, data, destinatário, assunto e texto. Baixe para criar modelos próprios.</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={baixarPadrao} className="gap-1.5"><Download className="h-4 w-4" /> Baixar</Button>
            {podeCriar && <Button size="sm" onClick={() => onUsar(null)} className="gap-1.5"><FilePlus2 className="h-4 w-4" /> Usar</Button>}
          </div>
        </CardContent>
      </Card>

      {carregando ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : porCategoria.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {modelos.length === 0 ? 'Nenhum modelo próprio ainda. Crie o primeiro a partir do modelo padrão.' : 'Nenhum modelo encontrado.'}
        </CardContent></Card>
      ) : (
        porCategoria.map(([cat, lista]) => (
          <div key={cat} className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">{cat} <span className="font-normal">({lista.length})</span></p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lista.map((m) => (
                <Card key={m.id} className={m.ativo ? '' : 'opacity-60'}>
                  <CardContent className="p-4 flex flex-col h-full gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted shrink-0"><FileText className={ehDocx(m.arquivo_nome) ? 'h-5 w-5 text-blue-600' : 'h-5 w-5 text-red-600'} /></div>
                      <div className="min-w-0">
                        <p className="font-semibold leading-tight break-words">{m.nome}</p>
                        {m.finalidade && <p className="text-xs text-muted-foreground">{m.finalidade}</p>}
                      </div>
                    </div>
                    {m.descricao && <p className="text-sm text-muted-foreground line-clamp-3">{m.descricao}</p>}
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <Badge variant="outline">{ehDocx(m.arquivo_nome) ? 'Word' : 'PDF'} · {tamanhoLegivel(m.arquivo_tamanho)}</Badge>
                      <Badge variant="outline">{usos.get(m.id) ?? 0} ofício(s)</Badge>
                      {!m.ativo && <Badge variant="secondary">Inativo</Badge>}
                    </div>
                    <div className="mt-auto grid grid-cols-2 gap-2">
                      {podeCriar && m.ativo && (
                        <Button size="sm" onClick={() => onUsar(m)} className="col-span-2 gap-1.5"><FilePlus2 className="h-4 w-4" /> Usar modelo</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => baixar(m)} className="gap-1.5"><Download className="h-4 w-4" /> Baixar</Button>
                      {podeCriar && <Button size="sm" variant="outline" onClick={() => setEditando(m)} className="gap-1.5"><Pencil className="h-4 w-4" /> Editar</Button>}
                      {canDelete && (
                        <Button size="sm" variant="ghost" onClick={() => setAExcluir(m)} className="col-span-2 gap-1.5 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" /> Excluir
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      <ModeloFormDialog aberto={editando !== undefined} modelo={editando ?? null} onClose={() => setEditando(undefined)} />
      <ConfirmDialog
        open={!!aExcluir}
        onOpenChange={(o) => { if (!o) setAExcluir(null); }}
        title={`Excluir o modelo "${aExcluir?.nome ?? ''}"?`}
        description={`O modelo e o arquivo dele serão apagados. ${aExcluir && usos.get(aExcluir.id) ? `Os ${usos.get(aExcluir.id)} ofício(s) que o usaram continuam cadastrados, sem o vínculo ao modelo.` : ''} Esta ação não pode ser desfeita. Para só esconder o modelo, edite e desmarque "Disponível".`}
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => { if (aExcluir) excluir.mutate(aExcluir); setAExcluir(null); }}
      />
    </div>
  );
}
