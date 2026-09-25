// Painel "Rota de visitas técnicas" do mapa de Produtores.
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, X, Loader2, Navigation, FileDown, AlertTriangle, ListPlus, Trash2 } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToast } from '@/hooks/use-toast';
import { otimizarRota, linksGoogleMaps, type ResultadoRota, type PontoRota } from './otimizarRota';

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
  const [res, setRes] = useState<{ r: ResultadoRota; paradas: Parada[]; partida: PontoRota; voltar: boolean } | null>(null);

  // Qualquer mudança nas paradas ou na partida invalida a rota calculada.
  const assinatura = selecionadas.map((p) => p.key).join(',') + `|${origem}|${voltar}`;
  useEffect(() => { setRes(null); onDesenhar(null); }, [assinatura]); // eslint-disable-line react-hooks/exhaustive-deps

  const naoSelecionadas = disponiveis.filter((d) => !selecionadas.some((s) => s.key === d.key));

  const calcular = async () => {
    if (selecionadas.length === 0) return;
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
      const ordenadas = r.ordem.map((i) => selecionadas[i]);
      setRes({ r, paradas: ordenadas, partida, voltar });
      onDesenhar({ partida, paradas: ordenadas, geometria: r.geometria, voltar });
      if (r.fonte === 'estimativa') {
        toast({ title: 'Serviço de rotas indisponível', description: 'Ordem calculada por estimativa em linha reta.' });
      }
    } finally {
      setCalculando(false);
    }
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

  const baixarPdf = async () => {
    if (!res) return;
    const { exportarRoteiroPdf } = await import('./roteiroPdf');
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
        ? 'Ordem de visitas otimizada para o menor tempo total de deslocamento, com tempos pelas estradas do OpenStreetMap. Tempos são estimativas; estradas vicinais podem variar com chuva e conservação.'
        : 'Ordem calculada por estimativa em linha reta (serviço de rotas indisponível no momento). Tempos aproximados.',
    );
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
          <div className="grid grid-cols-2 gap-1.5 text-center">
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
              <span>Longe de estrada mapeada (tempo pode ser maior): {res.r.longeDaEstrada.map((x) => `${selecionadas[x.indice]?.nome} (${fmtKm(x.metros)})`).join(', ')}</span>
            </p>
          )}
          <ol className="space-y-1">
            <li className="text-xs text-muted-foreground">Saída {hhmm(saidaMin)} — {nomePartida}</li>
            {res.paradas.map((p, i) => (
              <li key={p.key} className="flex gap-2 rounded-md border p-1.5">
                <span className="h-5 w-5 shrink-0 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{p.nome}</p>
                  <p className="text-[10.5px] text-muted-foreground truncate">{p.propriedade}</p>
                  <p className="text-[10.5px] text-muted-foreground">+{fmtKm(res.r.trechos[i].metros)} · {fmtMin(res.r.trechos[i].segundos)}</p>
                </div>
                <span className="text-xs font-semibold tabular-nums">{hhmm(chegadas[i])}</span>
              </li>
            ))}
            {retorno != null && (
              <li className="text-xs text-muted-foreground">
                Retorno {hhmm(retorno)} — +{fmtKm(res.r.trechos[res.r.trechos.length - 1].metros)} · {fmtMin(res.r.trechos[res.r.trechos.length - 1].segundos)}
              </li>
            )}
          </ol>
          <div className="flex flex-col gap-1.5">
            {linksGoogleMaps(res.partida, res.paradas, res.voltar).map((u, i, arr) => (
              <Button key={u} asChild variant="outline" size="sm" className="h-8">
                <a href={u} target="_blank" rel="noopener noreferrer">
                  <Navigation className="h-4 w-4 mr-1" /> Navegar no Google Maps{arr.length > 1 ? ` — trecho ${i + 1} de ${arr.length}` : ''}
                </a>
              </Button>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={baixarPdf}>
              <FileDown className="h-4 w-4 mr-1" /> Baixar roteiro (PDF)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
