// Decide a localização de uma etapa com foto do operador (logística) e a
// observação que fica no registro para o escritório:
//   * câmera  → GPS lido NA HORA DA FOTO; se não respondeu, lê agora e avisa;
//   * galeria → localização gravada na própria foto (EXIF), quando houver;
//               sem ela, lê agora e marca "foto da galeria".
import { format } from 'date-fns';
import { lerPosicaoPrecisa, dentroDaRegiao, type LeituraGps } from '@/lib/gpsPreciso';
import type { InfoFoto } from '@/components/SinglePhotoModal';

export async function localDaFoto(
  info: InfoFoto,
  lerAgora: () => Promise<LeituraGps | null> = lerPosicaoPrecisa,
): Promise<{ leitura: LeituraGps | null; nota: string | null }> {
  if (info.origem === 'galeria') {
    const ex = info.exif;
    const tirada = ex?.tiradaEm ? ` (tirada em ${format(ex.tiradaEm, 'dd/MM/yyyy HH:mm')})` : '';
    if (ex?.latitude != null && ex.longitude != null && dentroDaRegiao(ex.latitude, ex.longitude)) {
      return {
        leitura: { latitude: ex.latitude, longitude: ex.longitude, precisaoM: null },
        nota: `Foto da galeria${tirada} — localização gravada na própria foto.`,
      };
    }
    const leitura = (await info.leitura) ?? (await lerAgora());
    return {
      leitura,
      nota: `Foto da galeria${tirada} — a foto não trazia localização; `
        + (leitura ? 'usada a do momento do registro (pode não ser o local da foto).' : 'registrada sem localização.'),
    };
  }
  const naHora = await info.leitura;
  if (naHora) return { leitura: naHora, nota: null };
  const leitura = await lerAgora();
  return { leitura, nota: leitura ? 'GPS não respondeu na hora da foto — localização do momento do registro.' : null };
}
