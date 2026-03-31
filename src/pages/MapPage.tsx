import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProducers, useSettlements } from '@/hooks/useSupabaseData';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin } from 'lucide-react';

// Fix Leaflet default icon with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function createIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:26px;height:26px;
      background:${color};
      border:3px solid white;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:1px 2px 6px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -30],
  });
}

const blueIcon = createIcon('#3b82f6');

export default function MapPage() {
  const { data: producers = [], isLoading: producersLoading } = useProducers();
  const { data: settlements = [], isLoading: settlementsLoading } = useSettlements();
  const [settlementFilter, setSettlementFilter] = useState<string>('all');

  const isLoading = producersLoading || settlementsLoading;

  const producersWithCoords = useMemo(() => {
    return (producers as any[]).filter(p => p.latitude != null && p.longitude != null);
  }, [producers]);

  const filtered = useMemo(() => {
    if (settlementFilter === 'all') return producersWithCoords;
    return producersWithCoords.filter(p => p.settlement_id === settlementFilter);
  }, [producersWithCoords, settlementFilter]);

  const center = useMemo((): [number, number] => {
    if (filtered.length === 0) return [-10.9, -52.35];
    const avgLat = filtered.reduce((s: number, p: any) => s + Number(p.latitude), 0) / filtered.length;
    const avgLng = filtered.reduce((s: number, p: any) => s + Number(p.longitude), 0) / filtered.length;
    return [avgLat, avgLng];
  }, [filtered]);

  return (
    <AppLayout>
      <PageHeader
        title="Mapa de Produtores"
        description={`${producersWithCoords.length} produtor${producersWithCoords.length !== 1 ? 'es' : ''} com localização cadastrada`}
      />

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <Select value={settlementFilter} onValueChange={setSettlementFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por assentamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os assentamentos</SelectItem>
            {(settlements as any[]).map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline">
          {filtered.length} no mapa
        </Badge>
      </div>

      {isLoading ? (
        <Skeleton className="h-[500px] w-full rounded-xl" />
      ) : producersWithCoords.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Nenhum produtor com coordenadas cadastradas</p>
            <p className="text-sm mt-1">Edite os produtores e adicione latitude e longitude.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="h-[65vh] min-h-[400px] w-full">
              <MapContainer
                key={`${center[0].toFixed(4)}-${center[1].toFixed(4)}-${filtered.length}`}
                center={center}
                zoom={filtered.length > 0 ? 11 : 8}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {filtered.map((p: any) => {
                  const settlement = (settlements as any[]).find(s => s.id === p.settlement_id);
                  return (
                    <Marker
                      key={p.id}
                      position={[Number(p.latitude), Number(p.longitude)]}
                      icon={blueIcon}
                    >
                      <Popup>
                        <div className="min-w-[160px] text-sm">
                          <p className="font-semibold">{p.name}</p>
                          {settlement && <p className="text-gray-500 text-xs mt-0.5">{settlement.name}</p>}
                          {p.location_name && <p className="text-gray-500 text-xs">{p.location_name}</p>}
                          {p.phone && <p className="text-xs mt-1">📱 {p.phone}</p>}
                          <a
                            href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline block mt-1.5"
                          >
                            Abrir no Google Maps ↗
                          </a>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
