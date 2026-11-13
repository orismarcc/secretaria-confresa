// Checklist de regularização de uma associação: cada item mostra se está em
// dia, vencendo, vencido ou pendente, com "como obter", o documento que vale,
// histórico e a opção "não se aplica". Documentos avulsos ficam ao final.
import { useMemo, useRef, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  AlertTriangle, Ban, CheckCircle2, ChevronDown, Download, ExternalLink, Eye, FilePlus2, History, Loader2, Paperclip,
  Pencil, Plus, RotateCcw, Trash2, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  abrirArquivoAssociacao, useDispensarItem, useExcluirDocumento, useSalvarDocumento,
} from '@/hooks/useAssociacoes';
import { AnelRegularidade, Ajuda, StatusItemBadge, dataBR, hojeISO, selectCls } from './comum';
import {
  CATEGORIAS_CHECKLIST, problemaArquivo,
  type DocumentoAssociacao, type ItemChecklist, type Regularidade, type SituacaoItem,
} from '@/lib/associacoes';

// ─── Documento (adicionar / editar) ──────────────────────────────────────────

export function DocumentoDialog({ aberto, associacaoId, itens, itemInicial, documento, onClose }: {
  aberto: boolean;
  associacaoId: string;
  itens: ItemChecklist[];
  itemInicial: ItemChecklist | null;
  documento: DocumentoAssociacao | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const salvar = useSalvarDocumento();
  const inputRef = useRef<HTMLInputElement>(null);
  const [itemId, setItemId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [numero, setNumero] = useState('');
  const [emissao, setEmissao] = useState('');
  const [validade, setValidade] = useState('');
  const [obs, setObs] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setItemId(documento?.item_id ?? itemInicial?.id ?? '');
    setTitulo(documento?.titulo ?? itemInicial?.nome ?? '');
    setNumero(documento?.numero ?? '');
    setEmissao(documento?.data_emissao ?? hojeISO());
    setValidade(documento?.data_validade ?? '');
    setObs(documento?.observacao ?? '');
    setArquivo(null);
  }, [aberto, documento?.id, itemInicial?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const item = itens.find((i) => i.id === itemId) ?? null;
  const validadeInvalida = !!validade && !!emissao && validade < emissao;
  const faltaValidade = !!item?.tem_validade && !validade;
  const podeSalvar = titulo.trim().length > 0 && !validadeInvalida && (!!documento?.arquivo_path || !!arquivo) && !salvar.isPending;

  const escolher = (f: File | null) => {
    if (!f) return;
    const erro = problemaArquivo(f);
    if (erro) { toast({ title: erro, variant: 'destructive' }); return; }
    setArquivo(f);
  };

  const gravar = async () => {
    try {
      await salvar.mutateAsync({
        id: documento?.id,
        arquivo,
        arquivoAnterior: documento?.arquivo_path ?? null,
        dados: {
          associacao_id: associacaoId, item_id: itemId || null, titulo: titulo.trim(), numero: numero.trim() || null,
          data_emissao: emissao || null, data_validade: validade || null, observacao: obs.trim() || null,
        },
      });
      onClose();
    } catch { /* aviso já exibido */ }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o && !salvar.isPending) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5 text-primary" /> {documento ? 'Editar documento' : 'Adicionar documento'}</DialogTitle>
          <DialogDescription>Anexe o arquivo (PDF ou foto) e informe a validade quando o documento tiver prazo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="dc-item">Item do checklist</Label>
            <select id="dc-item" value={itemId} onChange={(e) => {
              setItemId(e.target.value);
              const it = itens.find((i) => i.id === e.target.value);
              if (it && (!titulo.trim() || itens.some((i) => i.nome === titulo))) setTitulo(it.nome);
            }} className={selectCls}>
              <option value="">Outro documento (fora do checklist)</option>
              {itens.filter((i) => i.ativo || i.id === itemId).map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
            </select>
            {item?.como_obter && <p className="text-xs text-muted-foreground"><strong>Como obter:</strong> {item.como_obter}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dc-titulo">Título *</Label>
            <Input id="dc-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Ata de assembleia de 10/03/2026" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dc-num">Nº / código</Label>
              <Input id="dc-num" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dc-em">Emissão</Label>
              <Input id="dc-em" type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dc-val">Validade{item?.tem_validade ? ' *' : ''}</Label>
              <Input id="dc-val" type="date" value={validade} onChange={(e) => setValidade(e.target.value)} aria-invalid={validadeInvalida} />
            </div>
          </div>
          {validadeInvalida && <p className="text-xs text-destructive">A validade não pode ser antes da emissão.</p>}
          {faltaValidade && <p className="text-xs text-amber-700 dark:text-amber-400">Este documento tem prazo: informe a validade (vem impressa no documento). Sem ela o item fica como "Falta a validade".</p>}
          <div className="space-y-1.5">
            <Label>Arquivo{documento?.arquivo_path ? '' : ' *'}</Label>
            <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx" className="hidden"
              onChange={(e) => { escolher(e.target.files?.[0] ?? null); e.target.value = ''; }} />
            {arquivo ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                <span className="flex items-center gap-2 min-w-0 text-sm"><Paperclip className="h-4 w-4 text-primary shrink-0" /><span className="truncate">{arquivo.name}</span></span>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setArquivo(null)} aria-label="Remover"><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => inputRef.current?.click()}>
                <Paperclip className="h-4 w-4 mr-2" /> {documento?.arquivo_path ? `Trocar arquivo (${documento.arquivo_nome})` : 'Escolher arquivo (PDF, foto ou Word)'}
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dc-obs">Observação</Label>
            <Textarea id="dc-obs" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={salvar.isPending}>Cancelar</Button>
          <Button onClick={gravar} disabled={!podeSalvar}>
            {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {documento ? 'Salvar' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Checklist ───────────────────────────────────────────────────────────────

export function ChecklistRegularizacao({ associacaoId, itens, regularidade, documentos }: {
  associacaoId: string;
  itens: ItemChecklist[];
  regularidade: Regularidade;
  documentos: DocumentoAssociacao[];
}) {
  const { toast } = useToast();
  const { canDelete } = useAuth();
  const dispensar = useDispensarItem();
  const excluir = useExcluirDocumento();
  const [docDialog, setDocDialog] = useState<{ item: ItemChecklist | null; documento: DocumentoAssociacao | null } | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [dispensando, setDispensando] = useState<SituacaoItem | null>(null);
  const [motivo, setMotivo] = useState('');
  const [aExcluir, setAExcluir] = useState<DocumentoAssociacao | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'pendencias'>('todos');

  const avulsos = useMemo(() => documentos.filter((d) => d.associacao_id === associacaoId && !d.item_id), [documentos, associacaoId]);
  const grupos = useMemo(() => CATEGORIAS_CHECKLIST.map((c) => ({
    categoria: c,
    itens: regularidade.itens.filter((s) => s.item.categoria === c.id
      && (filtro === 'todos' || ['pendente', 'vencido', 'sem_validade', 'vencendo'].includes(s.status))),
  })).filter((g) => g.itens.length), [regularidade, filtro]);

  const abrir = async (path: string, baixarComo?: string) => {
    try { await abrirArquivoAssociacao(path, baixarComo); }
    catch (e) { toast({ title: 'Não foi possível abrir o arquivo', description: (e as Error).message, variant: 'destructive' }); }
  };

  const LinhaDoc = ({ d, atual }: { d: DocumentoAssociacao; atual?: boolean }) => (
    <div className={cn('flex items-start justify-between gap-2 rounded-md border px-3 py-2 text-xs', atual && 'bg-muted/30')}>
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">{d.titulo}{atual && <span className="ml-1 font-normal text-success">(vale este)</span>}</p>
        <p className="text-muted-foreground">
          {d.numero ? `Nº ${d.numero} · ` : ''}Emissão {dataBR(d.data_emissao)}{d.data_validade ? ` · Validade ${dataBR(d.data_validade)}` : ''}
        </p>
        {d.observacao && <p className="italic text-muted-foreground">{d.observacao}</p>}
      </div>
      <div className="flex gap-0.5 shrink-0">
        {d.arquivo_path && <>
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Visualizar" onClick={() => abrir(d.arquivo_path!)}><Eye className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Baixar" onClick={() => abrir(d.arquivo_path!, d.arquivo_nome ?? 'documento')}><Download className="h-4 w-4" /></Button>
        </>}
        <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar" onClick={() => setDocDialog({ item: itens.find((i) => i.id === d.item_id) ?? null, documento: d })}><Pencil className="h-4 w-4" /></Button>
        {canDelete && <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title="Excluir" onClick={() => setAExcluir(d)}><Trash2 className="h-4 w-4" /></Button>}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
          <AnelRegularidade percentual={regularidade.percentual} regular={regularidade.regular} tamanho={84} />
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="font-semibold">
              {regularidade.obrigatoriosEmDia} de {regularidade.obrigatorios} itens obrigatórios em dia
            </p>
            {regularidade.regular ? (
              <p className="text-sm text-success flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Documentação regular.</p>
            ) : (
              <p className="text-sm text-destructive flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> {regularidade.pendencias.length} pendência(s): {regularidade.pendencias.slice(0, 3).map((p) => p.item.nome).join(', ')}{regularidade.pendencias.length > 3 ? '…' : ''}</p>
            )}
            {regularidade.vencendo.length > 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-400">{regularidade.vencendo.length} documento(s) vencendo nos próximos 30 dias.</p>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              Como funciona
              <Ajuda titulo="Como o checklist funciona">
                <p>Cada item pede um documento. Ao anexar, informe a validade quando houver: o sistema avisa 30 dias antes de vencer.</p>
                <p>Vale sempre o documento mais recente do item; os anteriores ficam no histórico.</p>
                <p>Itens opcionais não contam para a regularidade. Se um item obrigatório não se aplicar a esta associação, marque "não se aplica" com o motivo.</p>
              </Ajuda>
            </p>
          </div>
          <div className="flex sm:flex-col gap-2">
            <Button size="sm" onClick={() => setDocDialog({ item: null, documento: null })} className="gap-1.5"><Plus className="h-4 w-4" /> Documento</Button>
            <div className="inline-flex rounded-md border p-0.5 text-xs" role="tablist">
              {(['todos', 'pendencias'] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={filtro === v} onClick={() => setFiltro(v)}
                  className={cn('px-2 py-1 rounded', filtro === v ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                  {v === 'todos' ? 'Todos' : 'Só pendências'}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {grupos.length === 0 && (
        <Card><CardContent className="py-8 text-center text-sm text-success">Nenhuma pendência. 🎉</CardContent></Card>
      )}

      {grupos.map(({ categoria, itens: lista }) => (
        <div key={categoria.id} className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            {categoria.rotulo} <Ajuda titulo={categoria.rotulo}>{categoria.ajuda}</Ajuda>
          </p>
          <div className="space-y-2">
            {lista.map((s) => {
              const exp = aberto === s.item.id;
              return (
                <Card key={s.item.id} className={cn(s.status === 'dispensado' && 'opacity-70')}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <button type="button" onClick={() => setAberto(exp ? null : s.item.id)} aria-expanded={exp} className="flex-1 min-w-0 text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{s.item.nome}</span>
                          {!s.item.obrigatorio && <span className="text-[11px] text-muted-foreground border rounded px-1">opcional</span>}
                          <StatusItemBadge status={s.status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {s.status === 'dispensado' ? `Não se aplica: ${s.dispensa?.motivo}`
                            : s.documento ? `${s.documento.titulo}${s.documento.data_validade ? ` · validade ${dataBR(s.documento.data_validade)}` : ''}${s.diasParaVencer != null && s.diasParaVencer >= 0 && s.status === 'vencendo' ? ` (vence em ${s.diasParaVencer} dia(s))` : ''}${s.status === 'vencido' && s.diasParaVencer != null ? ` (venceu há ${Math.abs(s.diasParaVencer)} dia(s))` : ''}`
                            : 'Nenhum documento anexado.'}
                        </p>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        {s.status !== 'dispensado' && (
                          <Button size="sm" variant={s.status === 'ok' ? 'outline' : 'default'} className="h-8 gap-1"
                            onClick={() => setDocDialog({ item: s.item, documento: null })}>
                            <Plus className="h-4 w-4" /><span className="hidden sm:inline">{s.documento ? 'Atualizar' : 'Anexar'}</span>
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setAberto(exp ? null : s.item.id)} aria-label="Detalhes">
                          <ChevronDown className={cn('h-4 w-4 transition-transform', exp && 'rotate-180')} />
                        </Button>
                      </div>
                    </div>
                    {exp && (
                      <div className="mt-3 space-y-3 border-t pt-3">
                        {s.item.descricao && <p className="text-sm">{s.item.descricao}</p>}
                        {s.item.como_obter && (
                          <div className="rounded-md bg-primary/5 border border-primary/20 p-2.5 text-sm">
                            <p className="font-medium text-primary text-xs uppercase tracking-wide mb-0.5">Como obter</p>
                            <p>{s.item.como_obter}</p>
                            {s.item.link_oficial && (
                              <a href={s.item.link_oficial} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline text-xs mt-1">
                                <ExternalLink className="h-3.5 w-3.5" /> Abrir site oficial
                              </a>
                            )}
                          </div>
                        )}
                        {s.historico.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold flex items-center gap-1"><History className="h-3.5 w-3.5" /> Documentos ({s.historico.length})</p>
                            {s.historico.map((d, i) => <LinhaDoc key={d.id} d={d} atual={i === 0} />)}
                          </div>
                        )}
                        <div>
                          {s.status === 'dispensado' ? (
                            <Button size="sm" variant="outline" className="gap-1.5" disabled={dispensar.isPending}
                              onClick={() => dispensar.mutate({ associacao_id: associacaoId, item_id: s.item.id, motivo: null })}>
                              <RotateCcw className="h-4 w-4" /> Voltar a contar este item
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => { setMotivo(''); setDispensando(s); }}>
                              <Ban className="h-4 w-4" /> Não se aplica a esta associação
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Documentos avulsos */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
          Outros documentos <Ajuda>Documentos que não fazem parte do checklist (ofícios recebidos, projetos, contratos etc.).</Ajuda>
        </p>
        {avulsos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum. Use "+ Documento" e escolha "Outro documento".</p>
        ) : (
          <div className="space-y-1.5">{avulsos.map((d) => <LinhaDoc key={d.id} d={d} />)}</div>
        )}
      </div>

      <DocumentoDialog
        aberto={!!docDialog}
        associacaoId={associacaoId}
        itens={itens}
        itemInicial={docDialog?.item ?? null}
        documento={docDialog?.documento ?? null}
        onClose={() => setDocDialog(null)}
      />

      <Dialog open={!!dispensando} onOpenChange={(o) => { if (!o) setDispensando(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>"{dispensando?.item.nome}" não se aplica?</DialogTitle>
            <DialogDescription>O item deixa de contar na regularidade desta associação. Informe o motivo (fica registrado).</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ds-motivo">Motivo *</Label>
            <Textarea id="ds-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: a associação não possui empregados (FGTS)" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDispensando(null)}>Cancelar</Button>
            <Button disabled={!motivo.trim() || dispensar.isPending} onClick={async () => {
              if (!dispensando) return;
              try { await dispensar.mutateAsync({ associacao_id: associacaoId, item_id: dispensando.item.id, motivo: motivo.trim() }); setDispensando(null); } catch { /* aviso */ }
            }}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!aExcluir}
        onOpenChange={(o) => { if (!o) setAExcluir(null); }}
        title="Excluir documento?"
        description={`"${aExcluir?.titulo ?? ''}" e o arquivo anexado serão apagados. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => { if (aExcluir) excluir.mutate(aExcluir); setAExcluir(null); }}
      />
    </div>
  );
}
