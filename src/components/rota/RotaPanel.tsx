// Painel "Rota de visitas técnicas" do mapa de Produtores.
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, X, Loader2, Navigation, FileDown, AlertTriangle, ListPlus, Trash2, GripVertical, RotateCcw } from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToast } from '@/hooks/use-toast';
import { otimizarRota, linksGoogleMaps, linkGoogleMapsParada, type ResultadoRota, type PontoRota } from './otimizarRota';
// Import direto (não sob demanda): o jsPDF já está no pacote principal, e o
// carregamento sob demanda falhava para quem estava com a página aberta desde
// antes de uma atualização do sistema (o arquivo antigo deixa de existir).
import { exportarRoteiroPdf } from './roteiroPdf';

export const MAX_PARADAS = 25;

export interface Parada {
  key: string;
  nome: string;
  propriedade: string;
  telefone: string;
  lat: number;
  lng: number;
}

export interface RotaDesenho {
  partida: PontoRota;
  paradas: Parada[];          // já na ordem de visita
  geometria: [number, number][] | null;
  voltar: boolean;
}

const fmtMin = (s: number) => {
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
};
const fmtKm = (m: number) => `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: m < 10000 ? 1 : 0 })} km`;
const hhmm = (min: number) => {
  const t = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

// Parada da rota calculada — arrastável pela alça (mouse, toque ou teclado).
function ParadaArrastavel({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex gap-1.5 rounded-md border p-1.5 bg-background', isDragging && 'relative z-10 shadow-lg opacity-90')}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 -ml-0.5 cursor-grab active:cursor-grabbing touch-none rounded p-0.5 text-muted-foreground hover:bg-muted"
        aria-label="Arrastar para mudar a ordem"
        title="Arrastar para mudar a ordem"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </li>
  );
}

export function RotaPanel({ sede, selecionadas, disponiveis, onRemover, onAdicionarTodas, onLimpar, onDesenhar }: {
  sede: PontoRota & { nome: string };
  selecionadas: Parada[];
  disponiveis: Parada[];
  onRemover: (key: string) => void;
  onAdicionarTodas: (p: Parada[]) => void;
  onLimpar: () => void;
  onDesenhar: (d: RotaDesenho | null) => void;
}) {
  const { toast } = useToast();
  const { getCurrentPosition } = useGeolocation();
  const [origem, setOrigem] = useState<'sede' | 'gps'>('sede');
  const [gps, setGps] = useState<PontoRota | null>(null);
  const [voltar, setVoltar] = useState(true);
  const [saida, setSaida] = useState('07:00');
  const [visitaMin, setVisitaMin] = useState('30');
  const [calculando, setCalculando] = useState(false);
  const [res, setRes] = useState<{
    r: ResultadoRota; paradas: Parada[]; partida: PontoRota; voltar: boolean;
    /** Lista enviada ao cálculo (os índices de longeDaEstrada se referem a ela). */
    entrada: Parada[];
    /** Ordem arrastada pelo usuário (não é a calculada). */
    manual: boolean;
    /** Tempo dirigindo da melhor ordem (para comparar com a ordem manual). */
    melhor: { segundos: number; fonte: ResultadoRota['fonte'] };
    /** Recalculando depois de arrastar (tempos da lista ainda são os anteriores). */
    pendente: boolean;
  } | null>(null);
  const pedido = useRef(0); // só o último recálculo vale (arrastes seguidos)

  // Qualquer mudança nas paradas ou na partida invalida a rota calculada.
  const assinatura = selecionadas.map((p) => p.key).join(',') + `|${origem}|${voltar}`;
  useEffect(() => { pedido.current++; setRes(null); onDesenhar(null); }, [assinatura]); // eslint-disable-line react-hooks/exhaustive-deps

  const naoSelecionadas = disponiveis.filter((d) => !selecionadas.some((s) => s.key === d.key));

  const calcular = async () => {
    if (selecionadas.length === 0) return;
    const meu = ++pedido.current;
    setCalculando(true);
    try {
      let partida: PontoRota = { lat: sede.lat, lng: sede.lng };
      if (origem === 'gps') {
        try {
          const c = await getCurrentPosition();
          partida = { lat: c.latitude, lng: c.longitude };
          setGps(partida);
        } catch {
          toast({ title: 'Não foi possível obter sua localização', description: 'Usando a sede como ponto de partida.', variant: 'destructive' });
        }
      }
      const r = await otimizarRota(partida, selecionadas.map((p) => ({ lat: p.lat, lng: p.lng })), voltar);
      if (meu !== pedido.current) return;
      const ordenadas = r.ordem.map((i) => selecionadas[i]);
      const segundos = r.trechos.reduce((s, x) => s + x.segundos, 0);
      setRes({ r, paradas: ordenadas, partida, voltar, entrada: selecionadas, manual: false, melhor: { segundos, fonte: r.fonte }, pendente: false });
      onDesenhar({ partida, paradas: ordenadas, geometria: r.geometria, voltar });
      if (r.fonte === 'estimativa') {
        toast({ title: 'Serviço de rotas indisponível', description: 'Ordem calculada por estimativa em linha reta.' });
      }
    } finally {
      setCalculando(false);
    }
  };

  // Arrastar: recalcula tempos, distâncias, traçado e links NA ORDEM escolhida.
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const aoSoltar = async (e: DragEndEvent) => {
    if (!res || !e.over || e.active.id === e.over.id) return;
    const de = res.paradas.findIndex((p) => p.key === e.active.id);
    const para = res.paradas.findIndex((p) => p.key === e.over!.id);
    if (de < 0 || para < 0) return;
    const nova = arrayMove(res.paradas, de, para);
    const base = res;
    const meu = ++pedido.current;
    setRes({ ...base, paradas: nova, pendente: true });
    const r = await otimizarRota(base.partida, nova.map((p) => ({ lat: p.lat, lng: p.lng })), base.voltar, nova.map((_, i) => i));
    if (meu !== pedido.current) return;
    setRes({ ...base, r, paradas: nova, entrada: nova, manual: true, pendente: false });
    onDesenhar({ partida: base.partida, paradas: nova, geometria: r.geometria, voltar: base.voltar });
  };

  // Horários previstos
  const visitaS = Math.max(0, Number(visitaMin) || 0) * 60;
  const [hS, mS] = saida.split(':').map(Number);
  const saidaMin = (Number.isFinite(hS) ? hS : 7) * 60 + (Number.isFinite(mS) ? mS : 0);
  const chegadas: number[] = [];
  let t = saidaMin;
  res?.paradas.forEach((_, i) => { t += res.r.trechos[i].segundos / 60; chegadas.push(t); t += visitaS / 60; });
  const retorno = res && res.voltar ? t + res.r.trechos[res.r.trechos.length - 1].segundos / 60 : null;
  const totDirigindo = res ? res.r.trechos.reduce((s, x) => s + x.segundos, 0) : 0;
  const totMetros = res ? res.r.trechos.reduce((s, x) => s + x.metros, 0) : 0;
  const nomePartida = origem === 'gps' && gps ? 'Minha localização' : sede.nome;

  const [gerandoPdf, setGerandoPdf] = useState(false);
  const baixarPdf = async () => {
    if (!res || res.pendente || gerandoPdf) return;
    setGerandoPdf(true);
    try {
      await exportarRoteiroPdf(
        res.paradas.map((p, i) => ({
          ordem: i + 1, produtor: p.nome, propriedade: p.propriedade, telefone: p.telefone || '—',
          chegada: hhmm(chegadas[i]), trecho: `${fmtKm(res.r.trechos[i].metros)} · ${fmtMin(res.r.trechos[i].segundos)}`,
          coordenadas: `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
        })),
        [
          `Partida: ${nomePartida} às ${hhmm(saidaMin)} · ${res.paradas.length} visita(s) · ${visitaMin || 0} min por visita`,
          `Distância total: ${fmtKm(totMetros)} · Tempo dirigindo: ${fmtMin(totDirigindo)} · ${retorno != null ? `Retorno previsto: ${hhmm(retorno)}` : `Término previsto: ${hhmm(t)}`}`,
        ],
        res.r.fonte === 'estradas'
          ? `${res.manual ? 'Ordem de visitas definida manualmente' : 'Ordem de visitas otimizada para o menor tempo total de deslocamento'}, com tempos pelas estradas do OpenStreetMap. Tempos são estimativas; estradas vicinais podem variar com chuva e conservação.`
          : 'Ordem calculada por estimativa em linha reta (serviço de rotas indisponível no momento). Tempos aproximados.',
      );
    } catch (e) {
      toast({
        title: 'Não foi possível gerar o PDF do roteiro',
        description: e instanceof Error ? e.message : 'Tente novamente; se continuar, recarregue a página.',
        variant: 'destructive',
      });
    } finally {
      setGerandoPdf(false);
    }
  };

  return (
    <div className="rounded-lg border p-3 space-y-3 text-sm">
      <p className="font-semibold flex items-center gap-2"><Route className="h-4 w-4 text-primary" /> Rota de visitas técnicas</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Ponto de partida</Label>
          <Select value={origem} onValueChange={(v) => setOrigem(v as 'sede' | 'gps')}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sede">{sede.nome}</SelectItem>
              <SelectItem value="gps">Minha localização atual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Saída</Label>
          <Input type="time" className="h-9" value={saida} onChange={(e) => setSaida(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Min. por visita</Label>
          <Input type="number" min={0} max={480} className="h-9" value={visitaMin} onChange={(e) => setVisitaMin(e.target.value)} />
        </div>
        <label className="col-span-2 flex items-center gap-2 text-xs"><Switch checked={voltar} onCheckedChange={setVoltar} /> Voltar ao ponto de partida no fim</label>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">Paradas <span className={selecionadas.length > MAX_PARADAS ? 'text-destructive' : 'text-muted-foreground'}>({selecionadas.length}/{MAX_PARADAS})</span></p>
          {selecionadas.length > 0 && (
            <button type="button" onClick={onLimpar} className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"><Trash2 className="h-3 w-3" /> Limpar</button>
          )}
        </div>
        {selecionadas.length === 0 ? (
          <p className="text-xs text-muted-foreground">Toque nos pontos do mapa e escolha <b>Adicionar à rota</b>, ou adicione todos os do filtro atual (assentamento/gleba/busca).</p>
        ) : !res && (
          <div className="flex flex-wrap gap-1">
            {selecionadas.map((p) => (
              <span key={p.key} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs max-w-full">
                <span className="truncate max-w-[180px]">{p.nome}</span>
                <button type="button" title="Remover" onClick={() => onRemover(p.key)}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
        {naoSelecionadas.length > 0 && (
          <Button type="button" variant="outline" size="sm" className="w-full h-8"
            disabled={selecionadas.length >= MAX_PARADAS}
            onClick={() => onAdicionarTodas(naoSelecionadas.slice(0, MAX_PARADAS - selecionadas.length))}>
            <ListPlus className="h-4 w-4 mr-1" /> Adicionar os {Math.min(naoSelecionadas.length, MAX_PARADAS - selecionadas.length)} do filtro atual
          </Button>
        )}
      </div>

      <Button type="button" className="w-full" disabled={selecionadas.length === 0 || selecionadas.length > MAX_PARADAS || calculando} onClick={calcular}>
        {calculando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Route className="h-4 w-4 mr-2" />}
        {calculando ? 'Calculando a melhor rota…' : 'Calcular melhor rota'}
      </Button>

      {res && (
        <div className="space-y-2">
          {(res.manual || res.pendente) && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300/70 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
              {res.pendente ? <Loader2 className="h-3.5 w-3.5 shrink-0 mt-0.5 animate-spin" /> : <GripVertical className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
              <span className="flex-1">
                {res.pendente ? 'Recalculando na ordem escolhida…' : (() => {
                  const dif = Math.round((totDirigindo - res.melhor.segundos) / 60);
                  const comparavel = res.r.fonte === res.melhor.fonte;
                  return <>Ordem definida por você{comparavel && dif > 0 ? <> — <b>+{fmtMin(dif * 60)}</b> dirigindo em relação à melhor ordem</> : comparavel && dif <= 0 ? ' — mesmo tempo da melhor ordem' : ''}.</>;
                })()}
              </span>
              {!res.pendente && (
                <button type="button" onClick={calcular} disabled={calculando} className="shrink-0 inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
                  <RotateCcw className="h-3 w-3" /> Melhor ordem
                </button>
              )}
            </div>
          )}
          <div className={cn('grid grid-cols-2 gap-1.5 text-center', res.pendente && 'opacity-50')}>
            <div className="rounded-md bg-muted/50 p-1.5"><p className="font-bold">{fmtKm(totMetros)}</p><p className="text-[10px] text-muted-foreground">distância total</p></div>
            <div className="rounded-md bg-muted/50 p-1.5"><p className="font-bold">{fmtMin(totDirigindo)}</p><p className="text-[10px] text-muted-foreground">dirigindo</p></div>
            <div className="rounded-md bg-muted/50 p-1.5"><p className="font-bold">{fmtMin(totDirigindo + visitaS * res.paradas.length)}</p><p className="text-[10px] text-muted-foreground">com as visitas</p></div>
            <div className="rounded-md bg-muted/50 p-1.5"><p className="font-bold">{hhmm(retorno ?? t)}</p><p className="text-[10px] text-muted-foreground">{retorno != null ? 'retorno previsto' : 'término previsto'}</p></div>
          </div>
          {res.r.fonte === 'estimativa' && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 flex gap-1"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Serviço de rotas indisponível: ordem e tempos estimados em linha reta.</p>
          )}
          {res.r.longeDaEstrada.length > 0 && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 flex gap-1">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Longe de estrada mapeada (tempo pode ser maior): {res.r.longeDaEstrada.map((x) => `${res.entrada[x.indice]?.nome} (${fmtKm(x.metros)})`).join(', ')}</span>
            </p>
          )}
          {res.paradas.length > 1 && (
            <p className="text-[10.5px] text-muted-foreground flex items-center gap-1">
              <GripVertical className="h-3 w-3 shrink-0" /> Arraste pela alça para mudar a ordem — tempos, mapa e links são recalculados.
            </p>
          )}
          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
          <SortableContext items={res.paradas.map((p) => p.key)} strategy={verticalListSortingStrategy}>
          <ol className="space-y-1">
            <li className="text-xs text-muted-foreground">Saída {hhmm(saidaMin)} — {nomePartida}</li>
            {res.paradas.map((p, i) => (
              <ParadaArrastavel key={p.key} id={p.key}>
                <span className="h-5 w-5 shrink-0 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{p.nome}</p>
                  <p className="text-[10.5px] text-muted-foreground truncate">{p.propriedade}</p>
                  <p className="text-[10.5px] text-muted-foreground">{res.pendente ? '…' : `+${fmtKm(res.r.trechos[i].metros)} · ${fmtMin(res.r.trechos[i].segundos)}`}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs font-semibold tabular-nums">{res.pendente ? '…' : hhmm(chegadas[i])}</span>
                  <a
                    href={linkGoogleMapsParada(p)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Navegar até esta parada no Google Maps (a partir de onde você está)"
                    className="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10.5px] font-medium text-primary hover:bg-muted"
                  >
                    <Navigation className="h-3 w-3" /> Ir
                  </a>
                </div>
              </ParadaArrastavel>
            ))}
            {retorno != null && !res.pendente && (
              <li className="text-xs text-muted-foreground">
                Retorno {hhmm(retorno)} — +{fmtKm(res.r.trechos[res.r.trechos.length - 1].metros)} · {fmtMin(res.r.trechos[res.r.trechos.length - 1].segundos)}
              </li>
            )}
          </ol>
          </SortableContext>
          </DndContext>
          <div className="flex flex-col gap-1.5">
            {!res.pendente && linksGoogleMaps(res.partida, res.paradas, res.voltar).map((u, i, arr) => (
              <Button key={u} asChild variant="outline" size="sm" className="h-8">
                <a href={u} target="_blank" rel="noopener noreferrer">
                  <Navigation className="h-4 w-4 mr-1" /> Navegar no Google Maps{arr.length > 1 ? ` — trecho ${i + 1} de ${arr.length}` : ''}
                </a>
              </Button>
            ))}
            <p className="text-[10.5px] text-muted-foreground">
              Se o Google Maps não calcular a rota completa (alguma parada fora das estradas que ele conhece), use o botão <b>Ir</b> de cada parada.
            </p>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={baixarPdf} disabled={gerandoPdf || res.pendente}>
              {gerandoPdf ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />} Baixar roteiro (PDF)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
