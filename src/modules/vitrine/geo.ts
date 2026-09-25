// Conecta Confresa — localização dos fornecedores.

/** Centro de Confresa/MT (10°38′37″S, 51°34′08″O) — referência de "distância da sede". */
export const SEDE = { lat: -10.6436, lng: -51.5689, nome: 'Sede (centro de Confresa)' };

/** Distância em LINHA RETA (km), fórmula de Haversine. Não é a distância pela estrada. */
export function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface Coords { lat: number; lng: number; origem: 'fornecedor' | 'cadastro_rural' }

/**
 * Coordenadas do fornecedor: as marcadas na vitrine; se não houver, as do
 * cadastro rural vinculado. null quando nenhuma existe.
 */
export function coordsDoFornecedor(
  f: { latitude?: number | null; longitude?: number | null; producer_id: string | null },
  producersById: Map<string, { latitude?: number | null; longitude?: number | null }>,
): Coords | null {
  if (f.latitude != null && f.longitude != null) return { lat: Number(f.latitude), lng: Number(f.longitude), origem: 'fornecedor' };
  const p = f.producer_id ? producersById.get(f.producer_id) : undefined;
  if (p?.latitude != null && p?.longitude != null) return { lat: Number(p.latitude), lng: Number(p.longitude), origem: 'cadastro_rural' };
  return null;
}

export const fmtKm = (km: number) => `${km.toLocaleString('pt-BR', { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
