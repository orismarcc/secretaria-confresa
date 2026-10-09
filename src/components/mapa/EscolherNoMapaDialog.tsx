// "Procurar no mapa": escolher a localização clicando no mapa.
// Usado no cadastro do produtor (propriedade principal) e nas propriedades
// adicionais. Só devolve as coordenadas — quem chama preenche os campos e o
// cadastro é salvo normalmente depois.
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { adicionarCamadaBase } from '@/lib/mapa/camadaBase';
import { adicionarLimitesMunicipio } from '@/lib/mapa/limitesMunicipio';

const SEDE = { lat: -10.6436, lng: -51.5689 };

export interface PontoMapa { lat: number; lng: number }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ponto já informado (abre centrado nele). */
  inicial?: PontoMapa | null;
  /** Centro sugerido quando ainda não há ponto (ex.: o assentamento). */
  centroSugerido?: PontoMapa | null;
  onConfirm: (p: PontoMapa) => void;
}

const valido = (p?: PontoMapa | null): p is PontoMapa =>
  !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0)
  && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

export function EscolherNoMapaDialog({ open, onOpenChange, inicial, centroSugerido, onConfirm }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const marcaRef = useRef<L.CircleMarker | null>(null);
  const [ponto, setPonto] = useState<PontoMapa | null>(null);

  useEffect(() => {
    if (!open) return;
    const ini = valido(inicial) ? inicial : null;
    setPonto(ini);
    // Monta o mapa depois que o diálogo aparece (precisa do tamanho final).
    const t = setTimeout(() => {
      if (!divRef.current || mapRef.current) return;
      const centro = ini ?? (valido(centroSugerido) ? centroSugerido : SEDE);
      const map = L.map(divRef.current, { zoomControl: true }).setView([centro.lat, centro.lng], ini ? 16 : valido(centroSugerido) ? 14 : 10);
      const tirarFundo = adicionarCamadaBase(map);
      const tirarLimites = adicionarLimitesMunicipio(map);
      const marcar = (lat: number, lng: number) => {
        const p = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
        if (marcaRef.current) marcaRef.current.setLatLng([p.lat, p.lng]);
        else marcaRef.current = L.circleMarker([p.lat, p.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#dc2626', fillOpacity: 1 }).addTo(map);
        setPonto(p);
      };
      if (ini) marcar(ini.lat, ini.lng);
      map.on('click', (e: L.LeafletMouseEvent) => marcar(e.latlng.lat, e.latlng.lng));
      mapRef.current = map;
      (map as any)._tirar = () => { tirarFundo(); tirarLimites(); };
      setTimeout(() => map.invalidateSize(), 50);
    }, 150);
    return () => {
      clearTimeout(t);
      const map = mapRef.current;
      if (map) { try { (map as any)._tirar?.(); map.remove(); } catch { /* ok */ } }
      mapRef.current = null;
      marcaRef.current = null;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmar = () => {
    if (!ponto) return;
    onConfirm(ponto);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] p-4 gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Procurar no mapa</DialogTitle>
          <DialogDescription>
            Navegue até o local (use "Satélite" no canto do mapa para ver as propriedades) e toque no ponto exato.
          </DialogDescription>
        </DialogHeader>
        {/* isolate: mantém os z-index do Leaflet dentro do mapa */}
        <div ref={divRef} className="isolate h-[60vh] min-h-[320px] w-full rounded-lg border overflow-hidden cursor-crosshair" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <p className="flex-1 text-sm">
            {ponto
              ? <>Ponto marcado: <span className="font-mono font-medium">{ponto.lat.toFixed(6)}, {ponto.lng.toFixed(6)}</span></>
              : <span className="text-muted-foreground">Nenhum ponto marcado — toque no mapa.</span>}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="button" disabled={!ponto} onClick={confirmar}>Usar este ponto</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
