import { describe, it, expect, vi } from 'vitest';
import { localDaFoto } from './localDaFoto';

const ponto = { latitude: -10.65, longitude: -51.57, precisaoM: 12 };
const registro = { latitude: -10.64, longitude: -51.56, precisaoM: 20 };

describe('localização da etapa com foto', () => {
  it('câmera: usa a leitura feita na hora da foto (não lê de novo)', async () => {
    const lerAgora = vi.fn(async () => registro);
    const r = await localDaFoto({ origem: 'camera', leitura: Promise.resolve(ponto), exif: null }, lerAgora);
    expect(r).toEqual({ leitura: ponto, nota: null });
    expect(lerAgora).not.toHaveBeenCalled();
  });

  it('câmera sem GPS na hora: lê no registro e avisa', async () => {
    const r = await localDaFoto({ origem: 'camera', leitura: Promise.resolve(null), exif: null }, async () => registro);
    expect(r.leitura).toEqual(registro);
    expect(r.nota).toMatch(/momento do registro/);
  });

  it('galeria com localização na foto: usa a da foto', async () => {
    const lerAgora = vi.fn(async () => registro);
    const r = await localDaFoto({ origem: 'galeria', leitura: Promise.resolve(null),
      exif: { latitude: -10.7, longitude: -51.6, tiradaEm: new Date(2026, 9, 14, 9, 12) } }, lerAgora);
    expect(r.leitura).toEqual({ latitude: -10.7, longitude: -51.6, precisaoM: null });
    expect(r.nota).toBe('Foto da galeria (tirada em 14/10/2026 09:12) — localização gravada na própria foto.');
    expect(lerAgora).not.toHaveBeenCalled();
  });

  it('galeria sem localização (ou fora da região): usa a do registro e marca', async () => {
    const r = await localDaFoto({ origem: 'galeria', leitura: Promise.resolve(registro),
      exif: { latitude: 40, longitude: -3, tiradaEm: null } });
    expect(r.leitura).toEqual(registro);
    expect(r.nota).toMatch(/^Foto da galeria — a foto não trazia localização/);
  });
});
