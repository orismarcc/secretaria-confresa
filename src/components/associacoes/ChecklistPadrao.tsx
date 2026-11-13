// Checklist padrão de regularização (vale para todas as associações):
// ver, editar, incluir itens e desativar os que não forem mais exigidos.
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ExternalLink, ListChecks, Loader2, Pencil, Plus } from 'lucide-react';
import { useSalvarItemChecklist } from '@/hooks/useAssociacoes';
import { Ajuda, selectCls } from './comum';
import { CATEGORIAS_CHECKLIST, type CategoriaChecklist, type ItemChecklist } from '@/lib/associacoes';

function ItemDialog({ aberto, item, proximaOrdem, onClose }: { aberto: boolean; item: ItemChecklist | null; proximaOrdem: number; onClose: () => void }) {
  const salvar = useSalvarItemChecklist();
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<CategoriaChecklist>('constituicao');
  const [descricao, setDescricao] = useState('');
  const [como, setComo] = useState('');
  const [link, setLink] = useState('');
  const [obrigatorio, setObrigatorio] = useState(true);
  const [validade, setValidade] = useState(false);
  const [ordem, setOrdem] = useState('');
  const [ativo, setAtivo] = useState(true);
  useEffect(() => {
    if (!aberto) return;
    setNome(item?.nome ?? ''); setCategoria(item?.categoria ?? 'constituicao'); setDescricao(item?.descricao ?? '');
    setComo(item?.como_obter ?? ''); setLink(item?.link_oficial ?? ''); setObrigatorio(item?.obrigatorio ?? true);
    setValidade(item?.tem_validade ?? false); setOrdem(String(item?.ordem ?? proximaOrdem)); setAtivo(item?.ativo ?? true);
  }, [aberto, item?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const linkInvalido = !!link.trim() && !/^https:\/\//i.test(link.trim());
  const gravar = async () => {
    try {
      await salvar.mutateAsync({
        id: item?.id,
        dados: {
          nome: nome.trim(), categoria, descricao: descricao.trim() || null, como_obter: como.trim() || null,
          link_oficial: link.trim() || null, obrigatorio, tem_validade: validade, ordem: Number(ordem) || 100, ativo,
        },
      });
      onClose();
    } catch { /* aviso */ }
  };
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o && !salvar.isPending) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar item do checklist' : 'Novo item do checklist'}</DialogTitle>
          <DialogDescription>Vale para todas as associações.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="it-nome">Nome *</Label><Input id="it-nome" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="space-y-1.5"><Label htmlFor="it-cat">Grupo</Label>
              <select id="it-cat" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaChecklist)} className={selectCls}>
                {CATEGORIAS_CHECKLIST.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="it-ordem">Ordem</Label><Input id="it-ordem" inputMode="numeric" value={ordem} onChange={(e) => setOrdem(e.target.value.replace(/\D/g, ''))} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="it-desc">O que é</Label><Textarea id="it-desc" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="it-como">Como obter</Label><Textarea id="it-como" rows={2} value={como} onChange={(e) => setComo(e.target.value)} placeholder="Passo a passo curto para a equipe (e futuramente o presidente)" /></div>
          <div className="space-y-1.5">
            <Label htmlFor="it-link">Site oficial</Label>
            <Input id="it-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" aria-invalid={linkInvalido} />
            {linkInvalido && <p className="text-xs text-destructive">Use um endereço que comece com https://</p>}
          </div>
          {[
            { id: 'it-obr', rot: 'Obrigatório (conta para a regularidade)', v: obrigatorio, set: setObrigatorio },
            { id: 'it-val', rot: 'Tem validade (pedir a data e avisar antes de vencer)', v: validade, set: setValidade },
            { id: 'it-atv', rot: 'Ativo (aparece no checklist)', v: ativo, set: setAtivo },
          ].map((s) => (
            <label key={s.id} htmlFor={s.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 cursor-pointer">
              <span className="text-sm">{s.rot}</span><Switch id={s.id} checked={s.v} onCheckedChange={s.set} />
            </label>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={salvar.isPending}>Cancelar</Button>
          <Button onClick={gravar} disabled={!nome.trim() || linkInvalido || salvar.isPending}>{salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChecklistPadrao({ itens, podeEditar }: { itens: ItemChecklist[]; podeEditar: boolean }) {
  const [editando, setEditando] = useState<ItemChecklist | null | undefined>(undefined);
  const proxima = Math.max(0, ...itens.map((i) => i.ordem)) + 10;
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 shrink-0"><ListChecks className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="font-semibold">Checklist padrão de regularização</p>
              <p className="text-sm text-muted-foreground">Estes itens são cobrados de todas as associações. Itens desativados somem do checklist, mas os documentos já anexados ficam guardados.</p>
            </div>
          </div>
          {podeEditar && <Button onClick={() => setEditando(null)} className="gap-2 shrink-0"><Plus className="h-4 w-4" /> Novo item</Button>}
        </CardContent>
      </Card>
      {CATEGORIAS_CHECKLIST.map((c) => {
        const lista = itens.filter((i) => i.categoria === c.id).sort((a, b) => a.ordem - b.ordem);
        if (!lista.length) return null;
        return (
          <div key={c.id} className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">{c.rotulo} <Ajuda titulo={c.rotulo}>{c.ajuda}</Ajuda></p>
            {lista.map((i) => (
              <Card key={i.id} className={i.ativo ? '' : 'opacity-60'}>
                <CardContent className="p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{i.nome}</span>
                      <span className={`text-[11px] rounded px-1 border ${i.obrigatorio ? 'border-primary/40 text-primary' : 'text-muted-foreground'}`}>{i.obrigatorio ? 'obrigatório' : 'opcional'}</span>
                      {i.tem_validade && <span className="text-[11px] rounded px-1 border text-muted-foreground">com validade</span>}
                      {!i.ativo && <span className="text-[11px] rounded px-1 border text-muted-foreground">desativado</span>}
                    </div>
                    {i.como_obter && <p className="text-xs text-muted-foreground mt-0.5">{i.como_obter}</p>}
                    {i.link_oficial && <a href={i.link_oficial} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline inline-flex items-center gap-1 mt-0.5"><ExternalLink className="h-3 w-3" /> site oficial</a>}
                  </div>
                  {podeEditar && <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditando(i)} aria-label={`Editar ${i.nome}`}><Pencil className="h-4 w-4" /></Button>}
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })}
      <ItemDialog aberto={editando !== undefined} item={editando ?? null} proximaOrdem={proxima} onClose={() => setEditando(undefined)} />
    </div>
  );
}
