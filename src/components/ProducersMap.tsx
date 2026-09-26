// Mapa dos produtores (aba "Mapa" da página Produtores). Carregado sob demanda
// (Leaflet fica fora do pacote principal). Mesmo padrão do mapa do Conecta
// Confresa: OpenStreetMap, circleMarker e balão montado com textContent.
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPinOff, Route, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RotaPanel, MAX_PARADAS, type Parada, type RotaDesenho } from '@/components/rota/RotaPanel';
import { useAllProducerProperties } from '@/hooks/useSupabaseData';

/** Centro de Confresa/MT — referência de "distância da sede". */
const SEDE = { lat: -10.6436, lng: -51.5689, nome: 'Sede (centro de Confresa)' };
const PALETA = ['#15803d', '#2563eb', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#65a30d', '#db2777', '#4f46e5', '#b45309', '#0f766e', '#7c3aed'];

/** Distância em linha reta (Haversine), em km. */
function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
const fmtKm = (km: number) => `${km.toLocaleString('pt-BR', { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
const valida = (lat: unknown, lng: unknown) =>
  lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && !(Number(lat) === 0 && Number(lng) === 0);

export interface MapProducer {
  id: string;
  name: string;
  phone?: string | null;
  settlement_id?: string | null;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  settlements?: { name: string } | null;
  glebas?: { name: string } | null;
}

interface Ponto {
  key: string;
  producer: MapProducer;
  lat: number;
  lng: number;
  adicional: string | null; // nome da propriedade adicional (null = principal)
  settlementId: string;
  local: string;
}

function popupEl(p: Ponto, onAbrir: () => void, rota?: { naRota: boolean; alternar: () => void }): HTMLElement {
  const el = (tag: string, text?: string, style?: string) => {
    const e = document.createElement(tag);
    if (text != null) e.textContent = text;
    if (style) e.setAttribute('style', style);
    return e;
  };
  const root = el('div', undefined, 'font-family:inherit;min-width:190px;max-width:250px');
  root.appendChild(el('div', p.producer.name, 'font-weight:700;font-size:13px'));
  root.appendChild(el('div', p.adicional != null ? `Propriedade adicional${p.adicional ? ` — ${p.adicional}` : ''}` : 'Propriedade principal', 'font-size:11px;color:#555'));
  if (p.local) root.appendChild(el('div', p.local, 'font-size:11px;color:#555'));
  root.appendChild(el('div', `${fmtKm(distanciaKm(SEDE.lat, SEDE.lng, p.lat, p.lng))} da sede (linha reta)`, 'font-size:11px;color:#555'));
  root.appendChild(el('div', `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`, 'font-size:10.5px;color:#888;font-family:monospace;margin-bottom:6px'));
  const acoes = el('div', undefined, 'display:flex;gap:6px;flex-wrap:wrap');
  const btn = el('button', 'Abrir ficha', 'padding:4px 10px;border-radius:6px;border:1px solid #15803d;color:#15803d;background:#fff;font-size:12px;cursor:pointer');
  btn.addEventListener('click', onAbrir);
  acoes.appendChild(btn);
  const a = el('a', 'Como chegar', 'padding:4px 10px;border-radius:6px;border:1px solid #2563eb;color:#2563eb;background:#fff;font-size:12px;text-decoration:none') as HTMLAnchorElement;
  a.href = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  acoes.appendChild(a);
  if (rota) {
    const r = el('button', rota.naRota ? 'Remover da rota' : 'Adicionar à rota',
      `padding:4px 10px;border-radius:6px;border:1px solid #d97706;color:${rota.naRota ? '#d97706' : '#fff'};background:${rota.naRota ? '#fff' : '#d97706'};font-size:12px;cursor:pointer`);
    r.addEventListener('click', rota.alternar);
    acoes.appendChild(r);
  }
  root.appendChild(acoes);
  return root;
}

export default function ProducersMap({ producers, settlements, onOpenProducer }: {
  producers: MapProducer[];
  settlements: { id: string; name: string }[];
  onOpenProducer: (id: string) => void;
}) {
  const { data: propriedades = [] } = useAllProducerProperties();
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const abrirRef = useRef(onOpenProducer);
  abrirRef.current = onOpenProducer;
  const rotaLayerRef = useRef<L.LayerGroup | null>(null);

  // Rota de visitas: paradas selecionadas ficam guardadas mesmo ao trocar o
  // filtro (dá para montar uma rota com produtores de assentamentos diferentes).
  const [modoRota, setModoRota] = useState(false);
  const [semLocalAberto, setSemLocalAberto] = useState(false);
  const [sel, setSel] = useState<Map<string, Parada>>(new Map());
  const [desenho, setDesenho] = useState<RotaDesenho | null>(null);
  const paradaDe = (p: Ponto): Parada => ({
    key: p.key, nome: p.producer.name, telefone: p.producer.phone || '',
    propriedade: [p.adicional != null ? (p.adicional || 'Propriedade adicional') : null, p.local].filter(Boolean).join(' · ') || '—',
    lat: p.lat, lng: p.lng,
  });
  const alternarRef = useRef<(p: Ponto) => void>(() => {});
  alternarRef.current = (p: Ponto) => setSel((m) => {
    const n = new Map(m);
    if (n.has(p.key)) n.delete(p.key);
    else if (n.size < MAX_PARADAS) n.set(p.key, paradaDe(p));
    return n;
  });

  const { pontos, semLocal, cores } = useMemo(() => {
    const nomeAss = new Map(settlements.map((s) => [s.id, s.name]));
    const ids = new Set(producers.map((p) => p.id));
    const pontos: Ponto[] = [];
    const comLocal = new Set<string>();
    producers.forEach((p) => {
      if (!valida(p.latitude, p.longitude)) return;
      comLocal.add(p.id);
      pontos.push({
        key: p.id, producer: p, lat: Number(p.latitude), lng: Number(p.longitude), adicional: null,
        settlementId: p.settlement_id || '',
        local: [p.settlements?.name, p.glebas?.name, p.location_name].filter(Boolean).join(' · '),
      });
    });
    const porId = new Map(producers.map((p) => [p.id, p]));
    propriedades.forEach((pp) => {
      if (!ids.has(pp.producer_id) || !valida(pp.latitude, pp.longitude)) return;
      comLocal.add(pp.producer_id);
      pontos.push({
        key: pp.id, producer: porId.get(pp.producer_id)!, lat: Number(pp.latitude), lng: Number(pp.longitude),
        adicional: pp.name || '', settlementId: pp.settlement_id,
        local: [nomeAss.get(pp.settlement_id), pp.location_name].filter(Boolean).join(' · '),
      });
    });
    // Cor por assentamento (os mais numerosos primeiro).
    const cont = new Map<string, number>();
    pontos.forEach((p) => cont.set(p.settlementId, (cont.get(p.settlementId) || 0) + 1));
    const cores = [...cont.entries()].sort((a, b) => b[1] - a[1])
      .map(([id, n], i) => ({ id, nome: nomeAss.get(id) || 'Sem assentamento', n, cor: PALETA[i % PALETA.length] }));
    const semLocal = producers.filter((p) => !comLocal.has(p.id)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return { pontos, semLocal, cores };
  }, [producers, propriedades, settlements]);

  // Cria o mapa uma vez.
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, { zoomControl: true }).setView([SEDE.lat, SEDE.lng], 9);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; colaboradores do OpenStreetMap',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    rotaLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; rotaLayerRef.current = null; };
  }, []);

  // Atualiza os pontos.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const corDe = new Map(cores.map((c) => [c.id, c.cor]));
    L.circleMarker([SEDE.lat, SEDE.lng], { radius: 7, color: '#111827', weight: 2, fillColor: '#fbbf24', fillOpacity: 1 })
      .bindTooltip(SEDE.nome).addTo(layer);
    pontos.forEach((p) => {
      const naRota = modoRota && sel.has(p.key);
      L.circleMarker([p.lat, p.lng], {
        radius: naRota ? 9 : p.adicional != null ? 6 : 7,
        color: naRota ? '#d97706' : p.adicional != null ? '#111827' : '#fff',
        weight: naRota ? 3 : 2,
        fillColor: corDe.get(p.settlementId) || '#64748b',
        fillOpacity: 0.95,
      })
        .bindTooltip(p.adicional != null ? `${p.producer.name} (propriedade adicional)` : p.producer.name)
        .bindPopup(() => popupEl(p, () => abrirRef.current(p.producer.id),
          modoRota ? { naRota, alternar: () => { alternarRef.current(p); map.closePopup(); } } : undefined))
        .addTo(layer);
    });
    if (pontos.length > 0 && !desenho) {
      const b = L.latLngBounds([[SEDE.lat, SEDE.lng], ...pontos.map((p) => [p.lat, p.lng] as [number, number])]);
      map.fitBounds(b, { padding: [30, 30], maxZoom: 13 });
    }
  }, [pontos, cores, modoRota, sel, desenho]);

  // O mapa muda de largura ao abrir/fechar o painel da rota.
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [modoRota]);

  // Desenho da rota calculada: linha pelas estradas + paradas numeradas.
  useEffect(() => {
    const map = mapRef.current;
    const layer = rotaLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!desenho || !modoRota) return;
    const seq: [number, number][] = [
      [desenho.partida.lat, desenho.partida.lng],
      ...desenho.paradas.map((p) => [p.lat, p.lng] as [number, number]),
      ...(desenho.voltar ? [[desenho.partida.lat, desenho.partida.lng] as [number, number]] : []),
    ];
    const linha = desenho.geometria && desenho.geometria.length > 1 ? desenho.geometria : seq;
    L.polyline(linha, { color: '#d97706', weight: 4, opacity: 0.85, dashArray: desenho.geometria ? undefined : '6 6' }).addTo(layer);
    L.circleMarker([desenho.partida.lat, desenho.partida.lng], { radius: 8, color: '#111827', weight: 2, fillColor: '#fbbf24', fillOpacity: 1 })
      .bindTooltip('Partida').addTo(layer);
    desenho.paradas.forEach((p, i) => {
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:22px;height:22px;border-radius:9999px;background:#d97706;color:#fff;font:700 11px/22px sans-serif;text-align:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">${i + 1}</div>`,
          iconSize: [22, 22], iconAnchor: [11, 11],
        }),
      }).bindTooltip(`${i + 1}. ${p.nome}`).addTo(layer);
    });
    map.fitBounds(L.latLngBounds(linha), { padding: [30, 30], maxZoom: 14 });
  }, [desenho, modoRota]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{pontos.length}</span> propriedade(s) no mapa ·{' '}
        <span className="font-semibold text-foreground">{producers.length - semLocal.length}</span> de {producers.length} produtor(es) localizados.
        {' '}Cadastro sem localização recebe automaticamente o GPS do primeiro atendimento finalizado pelo operador; depois disso só muda se for editada no cadastro.
      </p>

      <div className="flex justify-end">
        <Button type="button" size="sm" variant={modoRota ? 'default' : 'outline'} onClick={() => setModoRota((v) => !v)}>
          <Route className="h-4 w-4 mr-1" /> {modoRota ? 'Fechar rota de visitas' : 'Montar rota de visitas'}
        </Button>
      </div>

      <div className={modoRota ? 'grid gap-3 lg:grid-cols-[1fr_340px] items-start' : ''}>
        {/* isolate: mantém os z-index do Leaflet dentro do mapa (não cobre fichas e janelas). */}
        <div ref={divRef} className="isolate h-[520px] w-full rounded-lg border overflow-hidden" />
        {modoRota && (
          <RotaPanel
            sede={SEDE}
            selecionadas={[...sel.values()]}
            disponiveis={pontos.map(paradaDe)}
            onRemover={(key) => setSel((m) => { const n = new Map(m); n.delete(key); return n; })}
            onAdicionarTodas={(ps) => setSel((m) => { const n = new Map(m); ps.forEach((p) => { if (n.size < MAX_PARADAS) n.set(p.key, p); }); return n; })}
            onLimpar={() => setSel(new Map())}
            onDesenhar={setDesenho}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#fbbf24', border: '2px solid #111827' }} /> Sede</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" style={{ border: '2px solid #111827' }} /> Propriedade adicional (borda escura)</span>
        {cores.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.cor }} /> {c.nome} ({c.n})
          </span>
        ))}
      </div>

      {semLocal.length > 0 && (
        <div className="rounded-lg border border-dashed text-sm">
          {/* Recolhido por padrão: a lista costuma ser longa. */}
          <button type="button" onClick={() => setSemLocalAberto((v) => !v)} aria-expanded={semLocalAberto}
            className="flex w-full items-center gap-2 p-3 text-left font-medium hover:bg-muted/40 rounded-lg">
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${semLocalAberto ? 'rotate-90' : ''}`} />
            <MapPinOff className="h-4 w-4 text-amber-600" /> {semLocal.length} produtor(es) sem localização
            <span className="ml-auto text-[11px] font-normal text-muted-foreground">{semLocalAberto ? 'recolher' : 'ver lista'}</span>
          </button>
          {semLocalAberto && (
          <div className="px-3 pb-3">
          <p className="text-[11px] text-muted-foreground mb-2">Serão localizados no próximo atendimento finalizado pelo operador, ou informe as coordenadas no cadastro.</p>
          <div className="flex flex-wrap gap-1.5">
            {semLocal.slice(0, 80).map((p) => (
              <button key={p.id} type="button" onClick={() => onOpenProducer(p.id)} className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted">
                {p.name}
              </button>
            ))}
            {semLocal.length > 80 && <span className="text-xs text-muted-foreground self-center">+ {semLocal.length - 80}</span>}
          </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
