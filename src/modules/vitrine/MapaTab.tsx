import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPinOff } from 'lucide-react';
import { useProducers } from '@/hooks/useSupabaseData';
import { useFornecedores, useOfertas, useProdutos, type Fornecedor, type Oferta } from './hooks';
import { statusInfo, unidadeLabel, mesesResumo, fmtNum, fmtBRL } from './constants';
import { SEDE, coordsDoFornecedor, distanciaKm, fmtKm } from './geo';

const ALL = '__all__';
const COR: Record<string, string> = { validado: '#15803d', em_analise: '#2563eb', recebido: '#d97706', pendencia: '#ea580c', inativo: '#94a3b8' };

/** Conteúdo do balão montado com textContent (nunca innerHTML com dados do cadastro). */
function popupEl(f: Fornecedor, ofertas: Oferta[], km: number, onAbrir: () => void): HTMLElement {
  const el = (tag: string, text?: string, style?: string) => {
    const e = document.createElement(tag);
    if (text != null) e.textContent = text;
    if (style) e.setAttribute('style', style);
    return e;
  };
  const root = el('div', undefined, 'font-family:inherit;min-width:200px;max-width:260px');
  root.appendChild(el('div', f.nome, 'font-weight:700;font-size:13px'));
  root.appendChild(el('div', `${statusInfo(f.status).label} · ${f.settlements?.name || 'sem assentamento'}`, 'font-size:11px;color:#555'));
  root.appendChild(el('div', `${fmtKm(km)} da sede (linha reta)`, 'font-size:11px;color:#555;margin-bottom:6px'));
  const lista = el('ul', undefined, 'margin:0;padding-left:14px;font-size:11.5px');
  ofertas.slice(0, 6).forEach((o) => {
    const partes = [
      `${o.vitrine_produtos?.nome || ''}${o.vitrine_variedades?.nome ? ` ${o.vitrine_variedades.nome}` : ''}`,
      o.qtd_mensal != null ? `${fmtNum(o.qtd_mensal)} ${unidadeLabel(o.unidade)}/mês` : null,
      mesesResumo(o.meses),
      o.preco != null ? `${fmtBRL(o.preco)}/${unidadeLabel(o.unidade)}${o.preco_entregue ? ' entregue' : ''}` : null,
      o.entrega_propria ? 'entrega própria' : null,
    ].filter(Boolean);
    lista.appendChild(el('li', partes.join(' · ')));
  });
  if (ofertas.length === 0) lista.appendChild(el('li', 'Sem ofertas ativas'));
  if (ofertas.length > 6) lista.appendChild(el('li', `+ ${ofertas.length - 6} oferta(s)`));
  root.appendChild(lista);
  const btn = el('button', 'Abrir ficha', 'margin-top:8px;padding:4px 10px;border-radius:6px;border:1px solid #15803d;color:#15803d;background:#fff;font-size:12px;cursor:pointer');
  btn.addEventListener('click', onAbrir);
  root.appendChild(btn);
  return root;
}

export function MapaTab({ onOpenFornecedor }: { onOpenFornecedor: (id: string) => void }) {
  const { data: fornecedores = [] } = useFornecedores();
  const { data: ofertas = [] } = useOfertas();
  const { data: produtos = [] } = useProdutos();
  const { data: producers = [] } = useProducers();
  const [produtoId, setProdutoId] = useState(ALL);
  const [soValidados, setSoValidados] = useState(false);

  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const abrirRef = useRef(onOpenFornecedor);
  abrirRef.current = onOpenFornecedor;

  const { pontos, semLocal } = useMemo(() => {
    const pById = new Map((producers as any[]).map((p) => [p.id, p]));
    const ofertasAtivas = ofertas.filter((o) => o.ativo);
    const pontos: { f: Fornecedor; lat: number; lng: number; km: number; ofertas: Oferta[] }[] = [];
    const semLocal: Fornecedor[] = [];
    fornecedores.forEach((f) => {
      if (f.status === 'inativo') return;
      if (soValidados && f.status !== 'validado') return;
      const minhas = ofertasAtivas.filter((o) => o.fornecedor_id === f.id);
      if (produtoId !== ALL && !minhas.some((o) => o.produto_id === produtoId)) return;
      const c = coordsDoFornecedor(f, pById);
      if (!c) { semLocal.push(f); return; }
      const lista = produtoId !== ALL ? minhas.filter((o) => o.produto_id === produtoId).concat(minhas.filter((o) => o.produto_id !== produtoId)) : minhas;
      pontos.push({ f, lat: c.lat, lng: c.lng, km: distanciaKm(SEDE.lat, SEDE.lng, c.lat, c.lng), ofertas: lista });
    });
    return { pontos, semLocal };
  }, [fornecedores, ofertas, producers, produtoId, soValidados]);

  // Cria o mapa uma vez.
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, { zoomControl: true }).setView([SEDE.lat, SEDE.lng], 9);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; colaboradores do OpenStreetMap',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  // Atualiza os pontos.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    L.circleMarker([SEDE.lat, SEDE.lng], { radius: 7, color: '#111827', weight: 2, fillColor: '#fbbf24', fillOpacity: 1 })
      .bindTooltip(SEDE.nome).addTo(layer);
    pontos.forEach((p) => {
      L.circleMarker([p.lat, p.lng], {
        radius: 8, color: '#fff', weight: 2, fillColor: COR[p.f.status] || '#2563eb', fillOpacity: 0.95,
      })
        .bindTooltip(p.f.nome)
        .bindPopup(() => popupEl(p.f, p.ofertas, p.km, () => abrirRef.current(p.f.id)))
        .addTo(layer);
    });
    if (pontos.length > 0) {
      const b = L.latLngBounds([[SEDE.lat, SEDE.lng], ...pontos.map((p) => [p.lat, p.lng] as [number, number])]);
      map.fitBounds(b, { padding: [30, 30], maxZoom: 13 });
    }
  }, [pontos]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={produtoId} onValueChange={setProdutoId}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os produtos</SelectItem>
            {produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm"><Switch checked={soValidados} onCheckedChange={setSoValidados} /> Só validados</label>
        <span className="text-sm text-muted-foreground ml-auto">{pontos.length} no mapa</span>
      </div>

      {/* isolate: mantém os z-index do Leaflet dentro do mapa (não cobre fichas e janelas). */}
      <div ref={divRef} className="isolate h-[460px] w-full rounded-lg border overflow-hidden" />

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#fbbf24', border: '2px solid #111827' }} /> Sede</span>
        {['validado', 'em_analise', 'recebido', 'pendencia'].map((s) => (
          <span key={s} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COR[s] }} /> {statusInfo(s).label}</span>
        ))}
        <span>· Distâncias em linha reta a partir do centro de Confresa.</span>
      </div>

      {semLocal.length > 0 && (
        <div className="rounded-lg border border-dashed p-3 text-sm">
          <p className="font-medium flex items-center gap-2"><MapPinOff className="h-4 w-4 text-amber-600" /> {semLocal.length} fornecedor(es) sem localização</p>
          <p className="text-[11px] text-muted-foreground mb-2">Vincule ao cadastro rural (que tenha coordenadas) ou marque a localização no cadastro do fornecedor.</p>
          <div className="flex flex-wrap gap-1.5">
            {semLocal.map((f) => (
              <button key={f.id} type="button" onClick={() => onOpenFornecedor(f.id)} className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted">
                {f.nome}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
