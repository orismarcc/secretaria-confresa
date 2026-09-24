import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Home, Plus, Pencil, Trash2, Navigation, Crosshair, Loader2, MapPin } from 'lucide-react';
import {
  useAllProducerProperties, useSaveProducerProperty, useDeleteProducerProperty,
  useSettlements, useGlebas, type ProducerProperty,
} from '@/hooks/useSupabaseData';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const NONE = '__none__';

interface Props {
  producerId: string;
  /** Dados da propriedade principal (a do cadastro do produtor), só para exibição. */
  principal: { settlementName?: string; glebaName?: string | null; locationName?: string | null };
}

const empty = { name: '', settlement_id: '', gleba_id: NONE, location_name: '', latitude: '', longitude: '' };

function openInMaps(lat: number, lng: number) {
  const url = `https://www.google.com/maps?q=${lat},${lng}`;
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) window.location.href = `geo:${lat},${lng}?q=${lat},${lng}`;
  else window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Propriedades do produtor: a PRINCIPAL (do cadastro) + as ADICIONAIS, que podem
 * estar em outros assentamentos. No atendimento, o produtor com mais de uma
 * propriedade exige escolher em qual delas o serviço será feito.
 */
export function ProducerPropertiesSection({ producerId, principal }: Props) {
  const { canDelete } = useAuth();
  const { toast } = useToast();
  const { data: all = [] } = useAllProducerProperties();
  const { data: settlements = [] } = useSettlements();
  const { data: glebas = [] } = useGlebas();
  const save = useSaveProducerProperty();
  const del = useDeleteProducerProperty();
  const { getCurrentPosition, isLoading: gpsLoading } = useGeolocation();

  const extras = useMemo(() => all.filter((p) => p.producer_id === producerId), [all, producerId]);
  const settlementName = (id?: string | null) => (settlements as any[]).find((s) => s.id === id)?.name || '—';
  const glebaName = (id?: string | null) => (glebas as any[]).find((g) => g.id === id)?.name || null;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProducerProperty | null>(null);
  const [toDelete, setToDelete] = useState<ProducerProperty | null>(null);
  const [f, setF] = useState(empty);

  const settlementGlebas = (glebas as any[]).filter((g) => g.settlement_id === f.settlement_id);

  const openNew = () => { setEditing(null); setF(empty); setOpen(true); };
  const openEdit = (p: ProducerProperty) => {
    setEditing(p);
    setF({
      name: p.name || '', settlement_id: p.settlement_id, gleba_id: p.gleba_id || NONE,
      location_name: p.location_name || '',
      latitude: p.latitude != null ? String(p.latitude) : '', longitude: p.longitude != null ? String(p.longitude) : '',
    });
    setOpen(true);
  };

  const marcarLocalizacao = async () => {
    try {
      const { latitude, longitude } = await getCurrentPosition();
      setF((s) => ({ ...s, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) }));
      toast({ title: 'Localização marcada', description: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` });
    } catch (e: any) {
      toast({ title: 'Não foi possível obter a localização', description: e?.message, variant: 'destructive' });
    }
  };

  const parseCoord = (v: string, min: number, max: number) => {
    const n = Number(v.replace(',', '.'));
    return v.trim() && Number.isFinite(n) && n >= min && n <= max ? n : null;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.settlement_id) return;
    const lat = parseCoord(f.latitude, -90, 90);
    const lng = parseCoord(f.longitude, -180, 180);
    if ((f.latitude.trim() && lat === null) || (f.longitude.trim() && lng === null)) {
      toast({ title: 'Coordenadas inválidas', description: 'Latitude entre -90 e 90; longitude entre -180 e 180.', variant: 'destructive' });
      return;
    }
    save.mutate({
      id: editing?.id,
      producer_id: producerId,
      name: f.name.trim() || null,
      settlement_id: f.settlement_id,
      // Gleba só vale se pertencer ao assentamento escolhido.
      gleba_id: f.gleba_id !== NONE && settlementGlebas.some((g) => g.id === f.gleba_id) ? f.gleba_id : null,
      location_name: f.location_name.trim().toUpperCase() || null,
      latitude: lat,
      longitude: lng,
    }, { onSuccess: () => setOpen(false) });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Propriedades</p>
          <Badge variant="secondary" className="text-xs">{extras.length + 1}</Badge>
        </div>
        <Button size="sm" variant="outline" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      <div className="space-y-2">
        {/* Principal — editada pelo formulário do produtor */}
        <div className="rounded-lg border p-2.5 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">Principal</Badge>
            <span className="font-medium truncate">{principal.settlementName || '—'}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {[principal.glebaName && `Gleba ${principal.glebaName}`, principal.locationName].filter(Boolean).join(' · ') || 'Localidade não informada'}
          </p>
        </div>

        {extras.map((p) => (
          <div key={p.id} className="rounded-lg border p-2.5 text-sm flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">
                {p.name ? `${p.name} — ` : ''}{settlementName(p.settlement_id)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {[glebaName(p.gleba_id) && `Gleba ${glebaName(p.gleba_id)}`, p.location_name].filter(Boolean).join(' · ') || 'Localidade não informada'}
              </p>
            </div>
            {p.latitude != null && p.longitude != null && (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Abrir no mapa" onClick={() => openInMaps(p.latitude!, p.longitude!)}>
                <Navigation className="h-4 w-4 text-blue-600" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => openEdit(p)}>
              <Pencil className="h-4 w-4" />
            </Button>
            {canDelete && (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={() => setToDelete(p)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar propriedade' : 'Nova propriedade'}</DialogTitle>
            <DialogDescription>Propriedade adicional do produtor — pode ser em outro assentamento.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pp-name">Nome da propriedade (opcional)</Label>
              <Input id="pp-name" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} placeholder="Ex.: Sítio Boa Vista" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Assentamento *</Label>
                <Select value={f.settlement_id} onValueChange={(v) => setF((s) => ({ ...s, settlement_id: v, gleba_id: NONE }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(settlements as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Gleba</Label>
                <Select value={f.gleba_id} disabled={settlementGlebas.length === 0} onValueChange={(v) => setF((s) => ({ ...s, gleba_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={settlementGlebas.length === 0 ? 'Sem glebas' : 'Selecione'} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nenhuma</SelectItem>
                    {settlementGlebas.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pp-loc">Localidade</Label>
              <Input id="pp-loc" value={f.location_name} onChange={(e) => setF((s) => ({ ...s, location_name: e.target.value.toUpperCase() }))} placeholder="Ex.: LOTE 12, VICINAL 3" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pp-lat">Latitude</Label>
                <Input id="pp-lat" inputMode="decimal" value={f.latitude} onChange={(e) => setF((s) => ({ ...s, latitude: e.target.value }))} placeholder="-10.6437" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pp-lng">Longitude</Label>
                <Input id="pp-lng" inputMode="decimal" value={f.longitude} onChange={(e) => setF((s) => ({ ...s, longitude: e.target.value }))} placeholder="-51.5689" />
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={marcarLocalizacao} disabled={gpsLoading}>
              {gpsLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Crosshair className="h-4 w-4 mr-2" />}
              {gpsLoading ? 'Obtendo localização…' : 'Marcar localização atual'}
            </Button>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={save.isPending || !f.settlement_id}>
                <MapPin className="h-4 w-4 mr-2" />{editing ? 'Salvar' : 'Adicionar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => { if (!o) setToDelete(null); }}
        title="Remover propriedade"
        description={toDelete ? `Remover a propriedade ${toDelete.name || settlementName(toDelete.settlement_id)}? Só é possível se não houver atendimentos nela.` : ''}
        onConfirm={() => { if (toDelete) del.mutate(toDelete.id); setToDelete(null); }}
        confirmLabel="Remover"
        variant="destructive"
      />
    </div>
  );
}
