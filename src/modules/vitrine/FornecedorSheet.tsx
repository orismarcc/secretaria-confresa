import { useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Pencil, Trash2, Plus, Phone, MapPin, FileText, Paperclip, Upload, Loader2, History, Sprout, MessageCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { statusVencimento, vencClasses, vencLabel } from '@/lib/vencimento';
import { useAuth } from '@/contexts/AuthContext';
import {
  useOfertas, useDocumentos, useSaveDocumento, useDeleteDocumento, useDeleteOferta, useSetStatusFornecedor,
  usePrecosHistDe, useSetSituacaoOferta, openDocumento, type Fornecedor, type Oferta, type Documento,
} from './hooks';
import {
  STATUS, TIPOS_DOC, SITUACOES_DOC, statusInfo, situacaoDocInfo, tipoDocLabel, programaLabel, perfilLabel,
  unidadeLabel, frequenciaLabel, mesesResumo, fmtNum, fmtBRL, SITUACOES_OFERTA, situacaoOfertaInfo,
} from './constants';
import { AceitarDialog } from './AceitarDialog';
import { avisosDoFornecedor } from './regras';
import { MesesBar } from './Meses';
import { OfertaForm } from './OfertaForm';

const fmtData = (v?: string | null) => (v ? format(new Date(v.length <= 10 ? `${v}T12:00:00` : v.replace(' ', 'T')), 'dd/MM/yyyy') : '—');

function PrecoHistorico({ ofertaIds }: { ofertaIds: string[] }) {
  const { data = [], isLoading } = usePrecosHistDe(ofertaIds);
  if (isLoading) return <p className="text-xs text-muted-foreground">Carregando…</p>;
  if (data.length === 0) return <p className="text-xs text-muted-foreground">Sem preços registrados.</p>;
  return (
    <ul className="space-y-0.5 text-xs">
      {data.map((h) => (
        <li key={h.id} className="flex justify-between gap-2">
          <span className="text-muted-foreground">{fmtData(h.registrado_em)}</span>
          <span>{fmtBRL(h.preco)}{h.unidade ? `/${unidadeLabel(h.unidade)}` : ''}{h.preco_entregue ? ' · entregue' : ''}</span>
        </li>
      ))}
    </ul>
  );
}

function OfertaCard({ o, irmas, onEdit, onDelete, onAceitar, canDelete }: {
  o: Oferta; irmas: Oferta[]; onEdit: () => void; onDelete: () => void; onAceitar: () => void; canDelete: boolean;
}) {
  const [hist, setHist] = useState(false);
  const setSit = useSetSituacaoOferta();
  const un = unidadeLabel(o.unidade);
  const sit = situacaoOfertaInfo(o.situacao);
  // Mesmo produto/variedade (esta + as "irmãs"): o histórico junta todas.
  const idsHistorico = [o.id, ...irmas.map((x) => x.id)];
  return (
    <div className={cn('rounded-lg border p-3 space-y-2', !o.ativo && 'opacity-60')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate">
            {o.vitrine_produtos?.nome}{o.vitrine_variedades?.nome ? ` — ${o.vitrine_variedades.nome}` : ''}
            {!o.ativo && <span className="ml-2 text-[10px] text-muted-foreground">(inativa)</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {o.qtd_mensal != null ? `${fmtNum(o.qtd_mensal)} ${un}/mês` : 'Quantidade não informada'} · {mesesResumo(o.meses)}
          </p>
        </div>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Histórico de preço" onClick={() => setHist((h) => !h)}><History className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
          {canDelete && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={o.situacao}
          onValueChange={(v) => (v === 'aceita' ? onAceitar() : setSit.mutate({ id: o.id, situacao: v }))}
        >
          <SelectTrigger className={cn('h-6 w-auto gap-1 px-2 text-[11px] border', sit.cls)}><SelectValue /></SelectTrigger>
          <SelectContent>{SITUACOES_OFERTA.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        {o.situacao === 'aceita' && (
          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            {programaLabel(o.programa)}{o.qtd_aceita != null ? ` · ${fmtNum(o.qtd_aceita)} ${un}/mês aceito` : ''}
          </span>
        )}
      </div>
      <MesesBar meses={o.meses} />
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <span className="font-semibold">{o.preco != null ? `${fmtBRL(o.preco)}/${un}` : 'Sem preço'}</span>
        {o.preco != null && <span className="text-muted-foreground">{o.preco_entregue ? 'com entrega' : 'retirado na propriedade'}</span>}
        {o.frequencia && <span className="text-muted-foreground">Entrega {frequenciaLabel(o.frequencia).toLowerCase()}</span>}
        {o.entrega_propria != null && <span className="text-muted-foreground">{o.entrega_propria ? 'Transporte próprio' : 'Sem transporte'}</span>}
        {o.emite_nota != null && <span className="text-muted-foreground">{o.emite_nota ? 'Emite nota' : 'Não emite nota'}</span>}
      </div>
      {hist && (
        <div className="rounded-md bg-muted/50 p-2">
          <p className="text-[11px] font-semibold mb-1">
            Histórico de preço{irmas.length > 0 ? ` (junta ${irmas.length + 1} ofertas deste produto)` : ''}
          </p>
          <PrecoHistorico ofertaIds={idsHistorico} />
        </div>
      )}
    </div>
  );
}

function DocumentoNovo({ fornecedorId }: { fornecedorId: string }) {
  const save = useSaveDocumento();
  const [tipo, setTipo] = useState('caf');
  const [numero, setNumero] = useState('');
  const [validade, setValidade] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const reset = () => { setTipo('caf'); setNumero(''); setValidade(''); setFile(null); if (ref.current) ref.current.value = ''; };
  const add = async () => {
    await save.mutateAsync({ fornecedor_id: fornecedorId, tipo, numero: numero.trim() || null, validade: validade || null, file });
    reset();
  };
  return (
    <div className="rounded-lg border border-dashed p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Documento</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS_DOC.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label className="text-xs">Número</Label><Input className="h-9" value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2 items-end">
        <div className="space-y-1"><Label className="text-xs">Validade</Label><Input className="h-9" type="date" value={validade} onChange={(e) => setValidade(e.target.value)} /></div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => ref.current?.click()}><Upload className="h-4 w-4 mr-1" /> Arquivo</Button>
          <span className="text-[11px] text-muted-foreground truncate">{file ? file.name : 'opcional'}</span>
          <input ref={ref} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={add} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} Adicionar documento
        </Button>
      </div>
    </div>
  );
}

interface Props {
  fornecedor: Fornecedor | null;
  onOpenChange: (o: boolean) => void;
  onEdit: (f: Fornecedor) => void;
  onDelete: (f: Fornecedor) => void;
}

export function FornecedorSheet({ fornecedor, onOpenChange, onEdit, onDelete }: Props) {
  const { canDelete } = useAuth();
  const { data: ofertasAll = [] } = useOfertas();
  const { data: docsAll = [] } = useDocumentos();
  const setStatus = useSetStatusFornecedor();
  const delOferta = useDeleteOferta();
  const saveDoc = useSaveDocumento();
  const delDoc = useDeleteDocumento();
  const [ofertaForm, setOfertaForm] = useState<{ open: boolean; oferta: Oferta | null }>({ open: false, oferta: null });
  const [ofertaDel, setOfertaDel] = useState<Oferta | null>(null);
  const [docDel, setDocDel] = useState<Documento | null>(null);
  const [aceitar, setAceitar] = useState<Oferta | null>(null);

  if (!fornecedor) return null;
  const ofertas = ofertasAll.filter((o) => o.fornecedor_id === fornecedor.id);
  const docs = docsAll.filter((d) => d.fornecedor_id === fornecedor.id);
  const mesmaChave = (a: Oferta, b: Oferta) => a.produto_id === b.produto_id && (a.variedade_id ?? null) === (b.variedade_id ?? null);
  const irmasDe = (o: Oferta) => ofertas.filter((x) => x.id !== o.id && mesmaChave(x, o));
  const duplicadas = ofertas.filter((o) => o.ativo && irmasDe(o).some((x) => x.ativo));
  const st = statusInfo(fornecedor.status);

  return (
    <Sheet open={!!fornecedor} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left flex items-center gap-2"><Sprout className="h-5 w-5 text-primary" /> {fornecedor.nome}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Situação e ações */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={fornecedor.status} onValueChange={(v) => setStatus.mutate({ id: fornecedor.id, status: v })}>
              <SelectTrigger className={cn('h-8 w-auto gap-2 border', st.cls)}><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
            {fornecedor.validado_em && <span className="text-[11px] text-muted-foreground">validado em {fmtData(fornecedor.validado_em)}</span>}
            <div className="ml-auto flex gap-1">
              <Button variant="outline" size="sm" onClick={() => onEdit(fornecedor)}><Pencil className="h-4 w-4 mr-1" /> Editar</Button>
              {canDelete && <Button variant="outline" size="sm" className="text-destructive" onClick={() => onDelete(fornecedor)}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          </div>

          {/* Dados */}
          <div className="grid gap-2 text-sm">
            {(fornecedor.telefone || fornecedor.whatsapp) && (
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />
                {fornecedor.telefone || '—'}
                {fornecedor.whatsapp && <span className="inline-flex items-center gap-1 text-success"><MessageCircle className="h-3.5 w-3.5" />{fornecedor.whatsapp}</span>}
              </p>
            )}
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />
              {[fornecedor.settlements?.name, fornecedor.localidade].filter(Boolean).join(' · ') || 'Local não informado'}
            </p>
            {fornecedor.perfis.length > 0 && (
              <div className="flex flex-wrap gap-1">{fornecedor.perfis.map((p) => <Badge key={p} variant="secondary">{perfilLabel(p)}</Badge>)}</div>
            )}
            <div className="text-xs text-muted-foreground">
              Interesse: {fornecedor.programas.length ? fornecedor.programas.map(programaLabel).join(', ') : 'não informado'}
              {' · '}{fornecedor.aceita_contato ? 'aceita contato' : 'NÃO aceita contato'}
              {fornecedor.producer_id && ' · vinculado ao cadastro rural'}
            </div>
            {fornecedor.observacao_interna && <p className="rounded-md bg-muted/50 p-2 text-xs">{fornecedor.observacao_interna}</p>}
          </div>

          <Separator />

          {/* Ofertas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Ofertas <span className="text-muted-foreground font-normal">({ofertas.length})</span></h3>
              <Button size="sm" onClick={() => setOfertaForm({ open: true, oferta: null })}><Plus className="h-4 w-4 mr-1" /> Oferta</Button>
            </div>
            {duplicadas.length > 0 && (
              <p className="rounded-md border border-amber-400/50 bg-amber-500/10 p-2 text-[11px] text-amber-800 dark:text-amber-300">
                Há ofertas repetidas do mesmo produto/variedade. Para atualizar preço ou quantidade, <strong>edite a oferta existente</strong> (o valor anterior vai para o histórico) e remova ou suspenda a repetida.
              </p>
            )}
            {ofertas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma oferta cadastrada.</p>
            ) : ofertas.map((o) => (
              <OfertaCard key={o.id} o={o} irmas={irmasDe(o)} canDelete={canDelete}
                onEdit={() => setOfertaForm({ open: true, oferta: o })} onDelete={() => setOfertaDel(o)}
                onAceitar={() => setAceitar(o)} />
            ))}
          </div>

          <Separator />

          {/* Documentos */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Documentos <span className="text-muted-foreground font-normal">({docs.length})</span></h3>
            {docs.map((d) => {
              const venc = d.validade ? statusVencimento(d.validade) : null;
              const sit = situacaoDocInfo(d.situacao);
              return (
                <div key={d.id} className="rounded-lg border p-2.5 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{tipoDocLabel(d.tipo)}{d.numero ? ` · Nº ${d.numero}` : ''}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {d.validade && venc && (
                        <span className={cn('text-[11px] font-medium rounded-full px-2 py-0.5', vencClasses(venc.status))}>
                          {fmtData(d.validade)} — {vencLabel(d.validade)}
                        </span>
                      )}
                      <Select value={d.situacao} onValueChange={(v) => saveDoc.mutate({ id: d.id, fornecedor_id: d.fornecedor_id, situacao: v })}>
                        <SelectTrigger className={cn('h-6 w-auto gap-1 px-2 text-[11px] border', sit.cls)}><SelectValue /></SelectTrigger>
                        <SelectContent>{SITUACOES_DOC.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  {d.file_path && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Abrir arquivo" onClick={() => openDocumento(d.file_path!)}>
                      <Paperclip className="h-4 w-4 text-blue-500" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDocDel(d)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
            <DocumentoNovo fornecedorId={fornecedor.id} />
          </div>
        </div>

        <OfertaForm
          open={ofertaForm.open}
          onOpenChange={(o) => setOfertaForm((s) => ({ ...s, open: o }))}
          fornecedorId={fornecedor.id}
          oferta={ofertaForm.oferta}
          ofertasDoFornecedor={ofertas}
          onEditarExistente={(o) => setOfertaForm({ open: true, oferta: o })}
        />
        <AceitarDialog
          oferta={aceitar}
          onOpenChange={(o) => { if (!o) setAceitar(null); }}
          avisos={avisosDoFornecedor(fornecedor.status, docs)}
        />
        <ConfirmDialog
          open={!!ofertaDel}
          onOpenChange={(o) => { if (!o) setOfertaDel(null); }}
          title="Remover oferta"
          description={ofertaDel ? `Remover a oferta de ${ofertaDel.vitrine_produtos?.nome}? O histórico de preço dela também será removido. Para só pausar, edite e desmarque "Oferta ativa".` : ''}
          onConfirm={() => { if (ofertaDel) delOferta.mutate(ofertaDel.id); setOfertaDel(null); }}
          confirmLabel="Remover"
          variant="destructive"
        />
        <ConfirmDialog
          open={!!docDel}
          onOpenChange={(o) => { if (!o) setDocDel(null); }}
          title="Remover documento"
          description={docDel ? `Remover "${tipoDocLabel(docDel.tipo)}" e o arquivo anexado?` : ''}
          onConfirm={() => { if (docDel) delDoc.mutate(docDel); setDocDel(null); }}
          confirmLabel="Remover"
          variant="destructive"
        />
      </SheetContent>
    </Sheet>
  );
}
