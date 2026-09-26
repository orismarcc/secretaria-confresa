// Mapa de calor da demanda (Análises). Carregado sob demanda (Leaflet).
// Camada 1 — por ASSENTAMENTO: círculo no ponto central, tamanho/cor pela
//   métrica escolhida (em aberto, espera, horas pedidas, concluídos).
// Camada 2 — por PROPRIEDADE: pontos das propriedades localizadas com
//   atendimento em aberto (fica mais preciso conforme o GPS dos operadores).
// Números calculados no banco (demanda_por_assentamento / demanda_pontos).
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format, startOfYear } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { MapPin, Crosshair, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  useDemandTypes, useDemandaPorAssentamento, useDemandaPontos, useSalvarPosicaoAssentamento,
  type DemandaAssentamento,
} from '@/hooks/useSupabaseData';

const SEDE = { lat: -10.6436, lng: -51.5689 };
type Metrica = 'abertos' | 'espera_media_dias' | 'horas_pedidas' | 'concluidos';
const METRICAS: { v: Metrica; label: string; un: string }[] = [
  { v: 'abertos', label: 'Atendimentos em aberto', un: '' },
  { v: 'espera_media_dias', label: 'Espera média (dias)', un: ' dias' },
  { v: 'horas_pedidas', label: 'Horas pedidas (em aberto)', un: ' h' },
  { v: 'concluidos', label: 'Concluídos no ano', un: '' },
];
// verde → amarelo → vermelho
const cor = (t: number) => `hsl(${Math.round(120 - 120 * Math.min(1, Math.max(0, t)))} 75% 42%)`;
const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export default function MapaDemanda() {
  const { canDelete } = useAuth();
  const { data: tipos = [] } = useDemandTypes();
  const [metrica, setMetrica] = useState<Metrica>('abertos');
  const [tipoId, setTipoId] = useState<string>('todos');
  const [verPontos, setVerPontos] = useState(true);
  const [marcando, setMarcando] = useState<DemandaAssentamento | null>(null);

  const hoje = new Date();
  const inicio = format(startOfYear(hoje), 'yyyy-MM-dd');
  const fim = format(hoje, 'yyyy-MM-dd');
  const tipo = tipoId === 'todos' ? null : tipoId;
  const { data: assent = [], isLoading } = useDemandaPorAssentamento(inicio, fim, tipo);
  const { data: pontos = [] } = useDemandaPontos(tipo, verPontos);
  const salvarPos = useSalvarPosicaoAssentamento();

  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const camadaRef = useRef<L.LayerGroup | null>(null);
  const marcandoRef = useRef(marcando);
  marcandoRef.current = marcando;
  const salvarRef = useRef(salvarPos.mutate);
  salvarRef.current = salvarPos.mutate;

  const info = METRICAS.find((m) => m.v === metrica)!;
  const max = useMemo(() => Math.max(1, ...assent.map((a) => Number(a[metrica]) || 0)), [assent, metrica]);
  const semPosicao = assent.filter((a) => a.posicao === 'sem' && (a.abertos > 0 || a.concluidos > 0));

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current).setView([SEDE.lat, SEDE.lng], 9);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; colaboradores do OpenStreetMap' }).addTo(map);
    camadaRef.current = L.layerGroup().addTo(map);
    // Modo "marcar posição": o próximo clique define o centro do assentamento.
    map.on('click', (e: L.LeafletMouseEvent) => {
      const alvo = marcandoRef.current;
      if (!alvo) return;
      salvarRef.current({ id: alvo.settlement_id, latitude: Number(e.latlng.lat.toFixed(6)), longitude: Number(e.latlng.lng.toFixed(6)) });
      setMarcando(null);
    });
    mapRef.current = map;
    // A seção abre com animação: mede de novo o tamanho depois de montar.
    const t1 = setTimeout(() => map.invalidateSize(), 120);
    const t2 = setTimeout(() => map.invalidateSize(), 500);
    return () => { clearTimeout(t1); clearTimeout(t2); map.remove(); mapRef.current = null; camadaRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const camada = camadaRef.current;
    if (!map || !camada) return;
    camada.clearLayers();
    if (verPontos) {
      pontos.forEach((p) => {
        L.circleMarker([p.lat, p.lng], { radius: 4 + Math.min(6, p.abertos), stroke: false, fillColor: '#dc2626', fillOpacity: 0.35 })
          .bindTooltip(`${p.abertos} em aberto nesta propriedade`).addTo(camada);
      });
    }
    const comPos = assent.filter((a) => a.latitude != null && a.longitude != null);
    comPos.forEach((a) => {
      const v = Number(a[metrica]) || 0;
      const t = v / max;
      L.circleMarker([a.latitude!, a.longitude!], {
        radius: 8 + 26 * Math.sqrt(t), color: '#fff', weight: 2,
        fillColor: v > 0 ? cor(t) : '#94a3b8', fillOpacity: 0.75,
        dashArray: a.posicao === 'estimada' ? '4 3' : undefined,
      })
        .bindTooltip(
          `${a.nome}: ${fmt(v)}${info.un}` +
          ` · ${a.abertos} em aberto · espera média ${fmt(a.espera_media_dias)} dias` +
          (a.posicao === 'estimada' ? ' (posição estimada)' : ''),
        )
        .addTo(camada);
    });
    if (comPos.length) {
      map.fitBounds(L.latLngBounds(comPos.map((a) => [a.latitude!, a.longitude!] as [number, number])), { padding: [40, 40], maxZoom: 11 });
    }
  }, [assent, pontos, metrica, max, verPontos, info.un]);

  useEffect(() => {
    const el = divRef.current;
    if (el) el.style.cursor = marcando ? 'crosshair' : '';
  }, [marcando]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={metrica} onValueChange={(v) => setMetrica(v as Metrica)}>
          <SelectTrigger className="h-9 w-[230px]"><SelectValue /></SelectTrigger>
          <SelectContent>{METRICAS.map((m) => <SelectItem key={m.v} value={m.v}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={tipoId} onValueChange={setTipoId}>
          <SelectTrigger className="h-9 w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os serviços</SelectItem>
            {(tipos as any[]).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-xs"><Switch checked={verPontos} onCheckedChange={setVerPontos} /> Propriedades localizadas</label>
      </div>

      {marcando && (
        <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <Crosshair className="h-4 w-4 text-primary" />
          <span className="flex-1">Clique no mapa onde fica o centro de <b>{marcando.nome}</b>.</span>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setMarcando(null)}><X className="h-4 w-4" /></Button>
        </div>
      )}

      <div ref={divRef} className="isolate h-[460px] w-full rounded-lg border overflow-hidden" />

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-16 rounded" style={{ background: 'linear-gradient(90deg, hsl(120 75% 42%), hsl(60 75% 42%), hsl(0 75% 42%))' }} /> menor → maior
        </span>
        <span>Tamanho e cor do círculo = {info.label.toLowerCase()}.</span>
        <span>Contorno tracejado = posição estimada pelos produtores localizados.</span>
        {verPontos && <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-600/40" /> propriedade com atendimento em aberto</span>}
      </div>

      {canDelete && semPosicao.length > 0 && (
        <div className="rounded-md border border-dashed p-2.5 text-xs">
          <p className="font-medium mb-1.5 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-amber-600" /> Assentamentos sem posição no mapa (não aparecem acima):</p>
          <div className="flex flex-wrap gap-1.5">
            {semPosicao.map((a) => (
              <button key={a.settlement_id} type="button" onClick={() => setMarcando(a)}
                className={cn('rounded-full border px-2.5 py-0.5 hover:bg-muted', marcando?.settlement_id === a.settlement_id && 'ring-2 ring-primary')}>
                {a.nome} — marcar
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-2 py-2 font-medium">Assentamento</th>
              <th className="px-2 py-2 font-medium text-right">Em aberto</th>
              <th className="px-2 py-2 font-medium text-right">Horas pedidas</th>
              <th className="px-2 py-2 font-medium text-right">Espera média</th>
              <th className="px-2 py-2 font-medium text-right">Espera máx.</th>
              <th className="px-2 py-2 font-medium text-right">Concluídos no ano</th>
              {canDelete && <th className="px-2 py-2 font-medium">Posição</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">Carregando…</td></tr>
            ) : assent.filter((a) => a.abertos > 0 || a.concluidos > 0).map((a) => (
              <tr key={a.settlement_id} className="border-t">
                <td className="px-2 py-1.5 font-medium">{a.nome}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{a.abertos}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmt(a.horas_pedidas)} h</td>
                <td className={cn('px-2 py-1.5 text-right tabular-nums', a.espera_media_dias > 60 && 'text-red-600 font-semibold')}>{a.abertos ? `${fmt(a.espera_media_dias)} dias` : '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{a.abertos ? `${a.espera_max_dias} dias` : '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{a.concluidos}</td>
                {canDelete && (
                  <td className="px-2 py-1.5">
                    <button type="button" onClick={() => setMarcando(a)} className="text-primary hover:underline">
                      {a.posicao === 'marcada' ? 'remarcar' : a.posicao === 'estimada' ? 'estimada · marcar' : 'marcar'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
