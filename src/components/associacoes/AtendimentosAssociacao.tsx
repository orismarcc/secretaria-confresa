// Atendimentos de patrulha mecanizada feitos pela associação com os
// associados — lançados como na Secretaria e somados aos números do município.
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Check, ChevronsUpDown, ClipboardList, Clock, Fuel, Layers, Loader2, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/text';
import { useAuth } from '@/contexts/AuthContext';
import { useDemandTypes, useMachinery, useProducers, useSettlements } from '@/hooks/useSupabaseData';
import { useExcluirAtendimentoAssociacao, useSalvarAtendimentoAssociacao } from '@/hooks/useAssociacoes';
import { Ajuda, dataBR, fmtNum, hojeISO, selectCls } from './comum';
import { calcularMetricas, type Associacao, type AtendimentoAssociacao, type Cessao } from '@/lib/associacoes';

type Produtor = { id: string; name: string; settlement_id?: string | null };
type TipoServico = { id: string; name: string; category?: string | null; is_active?: boolean | null };
type Maquina = { id: string; name: string; patrimony_number?: string | null };

const CATEGORIAS_MAQUINA = ['patrulha_mecanizada', 'implementos_equipamentos'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const numOuNulo = (v: string) => { const n = parseFloat(v.replace(',', '.')); return isNaN(n) ? null : n; };

function ProdutorBusca({ produtores, valor, onEscolher }: { produtores: Produtor[]; valor: string; onEscolher: (p: Produtor) => void }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const lista = useMemo(() => {
    const t = normalizeText(busca);
    return (t ? produtores.filter((p) => normalizeText(p.name).includes(t)) : produtores).slice(0, 80);
  }, [produtores, busca]);
  const sel = produtores.find((p) => p.id === valor);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={aberto} className="w-full justify-between font-normal h-10">
          <span className="truncate">{sel ? sel.name : 'Buscar produtor cadastrado…'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 opacity-50" />
          <Input autoFocus placeholder="Nome do produtor…" value={busca} onChange={(e) => setBusca(e.target.value)} className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-10" />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {lista.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum produtor encontrado</p> : lista.map((p) => (
            <button key={p.id} type="button" onClick={() => { onEscolher(p); setAberto(false); setBusca(''); }}
              className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-accent text-left', valor === p.id && 'bg-accent')}>
              <Check className={cn('h-4 w-4 shrink-0', valor === p.id ? 'opacity-100' : 'opacity-0')} />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AtendimentoDialog({ aberto, associacao, atendimento, cessoesAtivas, onClose }: {
  aberto: boolean; associacao: Associacao; atendimento: AtendimentoAssociacao | null; cessoesAtivas: Cessao[]; onClose: () => void;
}) {
  const salvar = useSalvarAtendimentoAssociacao();
  const { data: produtores = [] } = useProducers();
  const { data: tipos = [] } = useDemandTypes();
  const { data: maquinas = [] } = useMachinery();
  const { data: assentamentos = [] } = useSettlements();
  const [semCadastro, setSemCadastro] = useState(false);
  const [produtorId, setProdutorId] = useState('');
  const [produtorNome, setProdutorNome] = useState('');
  const [tipo, setTipo] = useState('');
  const [maquina, setMaquina] = useState('');
  const [assentamento, setAssentamento] = useState('');
  const [data, setData] = useState('');
  const [horas, setHoras] = useState('');
  const [area, setArea] = useState('');
  const [litros, setLitros] = useState('');
  const [obs, setObs] = useState('');

  useEffect(() => {
    if (!aberto) return;
    const a = atendimento;
    setSemCadastro(!!a && !a.producer_id);
    setProdutorId(a?.producer_id ?? ''); setProdutorNome(a?.produtor_nome ?? '');
    setTipo(a?.demand_type_id ?? ''); setData(a?.data_atendimento ?? hojeISO());
    setMaquina(a?.machinery_id ?? (cessoesAtivas.length === 1 ? cessoesAtivas[0].machinery_id : ''));
    setAssentamento(a?.settlement_id ?? associacao.settlement_id ?? '');
    setHoras(a?.horas != null ? String(a.horas).replace('.', ',') : '');
    setArea(a?.area_ha != null ? String(a.area_ha).replace('.', ',') : '');
    setLitros(a?.combustivel_litros != null ? String(a.combustivel_litros).replace('.', ',') : '');
    setObs(a?.observacao ?? '');
  }, [aberto, atendimento?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const tiposMaquina = (tipos as TipoServico[]).filter((t) => CATEGORIAS_MAQUINA.includes(t.category ?? '') && (t.is_active !== false || t.id === tipo));
  const cedidas = new Set(cessoesAtivas.map((c) => c.machinery_id));
  const maquinasOrd = [...(maquinas as Maquina[])].sort((a, b) => Number(cedidas.has(b.id)) - Number(cedidas.has(a.id)) || a.name.localeCompare(b.name));
  const temProdutor = semCadastro ? produtorNome.trim().length > 0 : !!produtorId;
  const podeSalvar = temProdutor && !!tipo && !!data && !salvar.isPending;

  const gravar = async () => {
    try {
      await salvar.mutateAsync({
        id: atendimento?.id,
        dados: {
          associacao_id: associacao.id,
          producer_id: semCadastro ? null : produtorId || null,
          produtor_nome: semCadastro ? produtorNome.trim() : null,
          demand_type_id: tipo, machinery_id: maquina || null, settlement_id: assentamento || null,
          data_atendimento: data, horas: numOuNulo(horas), area_ha: numOuNulo(area), combustivel_litros: numOuNulo(litros),
          observacao: obs.trim() || null,
        },
      });
      onClose();
    } catch { /* aviso */ }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o && !salvar.isPending) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" /> {atendimento ? 'Editar atendimento' : 'Novo atendimento da associação'}</DialogTitle>
          <DialogDescription>Mesmas informações de um atendimento da Secretaria: quem foi atendido, o serviço, a máquina e quanto foi feito.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Produtor (associado) *</Label>
            {semCadastro
              ? <Input value={produtorNome} onChange={(e) => setProdutorNome(e.target.value)} placeholder="Nome completo do associado" aria-label="Nome do associado" />
              : <ProdutorBusca produtores={produtores as Produtor[]} valor={produtorId} onEscolher={(p) => { setProdutorId(p.id); if (p.settlement_id && !assentamento) setAssentamento(p.settlement_id); }} />}
            <button type="button" className="text-xs text-primary underline" onClick={() => setSemCadastro((v) => !v)}>
              {semCadastro ? 'Escolher produtor já cadastrado' : 'Associado ainda não tem cadastro de produtor'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="at-tipo">Serviço *</Label>
              <select id="at-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectCls}>
                <option value="">Selecione…</option>
                {tiposMaquina.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="at-data">Data *</Label>
              <Input id="at-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="at-maq">Máquina usada</Label>
            <select id="at-maq" value={maquina} onChange={(e) => setMaquina(e.target.value)} className={selectCls}>
              <option value="">Não informada / própria da associação</option>
              {maquinasOrd.map((m) => <option key={m.id} value={m.id}>{cedidas.has(m.id) ? '★ ' : ''}{m.name}{m.patrimony_number ? ` (${m.patrimony_number})` : ''}</option>)}
            </select>
            {cedidas.size > 0 && <p className="text-xs text-muted-foreground">★ = cedida a esta associação.</p>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label htmlFor="at-h">Horas</Label><Input id="at-h" inputMode="decimal" value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="0" /></div>
            <div className="space-y-1.5"><Label htmlFor="at-a">Área (ha)</Label><Input id="at-a" inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value)} placeholder="0" /></div>
            <div className="space-y-1.5"><Label htmlFor="at-l">Combustível (L)</Label><Input id="at-l" inputMode="decimal" value={litros} onChange={(e) => setLitros(e.target.value)} placeholder="0" /></div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="at-ass">Assentamento / comunidade</Label>
            <select id="at-ass" value={assentamento} onChange={(e) => setAssentamento(e.target.value)} className={selectCls}>
              <option value="">—</option>
              {(assentamentos as { id: string; name: string }[]).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="at-obs">Observação</Label>
            <Textarea id="at-obs" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={salvar.isPending}>Cancelar</Button>
          <Button onClick={gravar} disabled={!podeSalvar}>{salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{atendimento ? 'Salvar' : 'Registrar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function KpisAtendimentos({ lista }: { lista: AtendimentoAssociacao[] }) {
  const t = calcularMetricas(lista).total;
  const kpis = [
    { rot: 'Atendimentos', v: fmtNum(t.atendimentos, 0), Ic: ClipboardList },
    { rot: 'Horas de máquina', v: `${fmtNum(t.horas)} h`, Ic: Clock },
    { rot: 'Área trabalhada', v: `${fmtNum(t.area)} ha`, Ic: Layers },
    { rot: 'Combustível', v: `${fmtNum(t.combustivel, 0)} L`, Ic: Fuel },
    { rot: 'Produtores atendidos', v: fmtNum(t.produtores, 0), Ic: Users },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {kpis.map(({ rot, v, Ic }) => (
        <div key={rot} className="rounded-lg border bg-card p-3">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Ic className="h-3.5 w-3.5 text-primary" /> {rot}</p>
          <p className="text-lg font-bold tabular-nums">{v}</p>
        </div>
      ))}
    </div>
  );
}

export function GraficoMensal({ lista }: { lista: AtendimentoAssociacao[] }) {
  const dados = calcularMetricas(lista).porMes.slice(-12).map((m) => ({ mes: `${MESES[Number(m.mes.slice(5)) - 1]}/${m.mes.slice(2, 4)}`, horas: Number(m.horas.toFixed(1)), atendimentos: m.atendimentos }));
  if (!dados.length) return null;
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v: number, n: string) => [n === 'horas' ? `${fmtNum(v)} h` : v, n === 'horas' ? 'Horas' : 'Atendimentos']} />
          <Bar dataKey="horas" fill="#16a34a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AtendimentosAssociacao({ associacao, atendimentos, cessoesAtivas }: {
  associacao: Associacao; atendimentos: AtendimentoAssociacao[]; cessoesAtivas: Cessao[];
}) {
  const { canDelete } = useAuth();
  const excluir = useExcluirAtendimentoAssociacao();
  const { data: produtores = [] } = useProducers();
  const { data: tipos = [] } = useDemandTypes();
  const { data: maquinas = [] } = useMachinery();
  const [editando, setEditando] = useState<AtendimentoAssociacao | null | undefined>(undefined);
  const [aExcluir, setAExcluir] = useState<AtendimentoAssociacao | null>(null);
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const filtrados = atendimentos.filter((a) => (!de || a.data_atendimento >= de) && (!ate || a.data_atendimento <= ate));
  const nomeProd = (a: AtendimentoAssociacao) => a.produtor_nome || (produtores as Produtor[]).find((p) => p.id === a.producer_id)?.name || '—';
  const nomeTipo = (id: string) => (tipos as TipoServico[]).find((t) => t.id === id)?.name ?? '—';
  const nomeMaq = (id: string | null) => (id ? (maquinas as Maquina[]).find((m) => m.id === id)?.name ?? '—' : '—');

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-2 justify-between">
        <div className="flex gap-2">
          <div className="space-y-1"><Label htmlFor="fa-de" className="text-xs">De</Label><Input id="fa-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-9" /></div>
          <div className="space-y-1"><Label htmlFor="fa-ate" className="text-xs">Até</Label><Input id="fa-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9" /></div>
        </div>
        <div className="flex items-center gap-2">
          <Ajuda titulo="Atendimentos da associação">Lance cada serviço que a associação fez para um associado. Eles entram nos números do município (página Análises) e mostram como as máquinas cedidas estão sendo usadas.</Ajuda>
          <Button size="sm" onClick={() => setEditando(null)} className="gap-1.5"><Plus className="h-4 w-4" /> Novo atendimento</Button>
        </div>
      </div>

      <KpisAtendimentos lista={filtrados} />
      {filtrados.length > 0 && <Card><CardContent className="p-3"><p className="text-sm font-medium mb-1">Horas de máquina por mês</p><GraficoMensal lista={filtrados} /></CardContent></Card>}

      {filtrados.length === 0 ? (
        <Card><CardContent className="py-8 text-center space-y-2">
          <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{atendimentos.length ? 'Nenhum atendimento no período.' : 'Nenhum atendimento registrado ainda.'}</p>
          {!atendimentos.length && <Button size="sm" variant="outline" onClick={() => setEditando(null)} className="gap-1.5"><Plus className="h-4 w-4" /> Registrar o primeiro</Button>}
        </CardContent></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-muted/40 border-b text-muted-foreground">
                <tr><th className="px-3 py-2 text-left font-medium">Data</th><th className="px-3 py-2 text-left font-medium">Produtor</th><th className="px-3 py-2 text-left font-medium">Serviço</th><th className="px-3 py-2 text-left font-medium">Máquina</th><th className="px-3 py-2 text-right font-medium">Horas</th><th className="px-3 py-2 text-right font-medium">Área</th><th className="w-20" /></tr>
              </thead>
              <tbody>
                {filtrados.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 tabular-nums">{dataBR(a.data_atendimento)}</td>
                    <td className="px-3 py-2">{nomeProd(a)}{!a.producer_id && <span className="ml-1 text-[10px] text-muted-foreground">(sem cadastro)</span>}</td>
                    <td className="px-3 py-2">{nomeTipo(a.demand_type_id)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{nomeMaq(a.machinery_id)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.horas != null ? `${fmtNum(Number(a.horas))} h` : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.area_ha != null ? `${fmtNum(Number(a.area_ha))} ha` : '—'}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar" onClick={() => setEditando(a)}><Pencil className="h-4 w-4" /></Button>
                      {canDelete && <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title="Excluir" onClick={() => setAExcluir(a)}><Trash2 className="h-4 w-4" /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <AtendimentoDialog aberto={editando !== undefined} associacao={associacao} atendimento={editando ?? null} cessoesAtivas={cessoesAtivas} onClose={() => setEditando(undefined)} />
      <ConfirmDialog open={!!aExcluir} onOpenChange={(o) => { if (!o) setAExcluir(null); }} title="Excluir atendimento?"
        description="O atendimento deixa de contar nos números da associação e do município. Esta ação não pode ser desfeita."
        confirmLabel="Excluir" variant="destructive" onConfirm={() => { if (aExcluir) excluir.mutate(aExcluir); setAExcluir(null); }} />
    </div>
  );
}
