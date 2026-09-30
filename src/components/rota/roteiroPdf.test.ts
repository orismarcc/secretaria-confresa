import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { montarRoteiroPdf } from './roteiroPdf';

// Sem logo no teste (o jsdom não carrega imagens): simula falha de carregamento.
class ImagemQueFalha {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_: string) { setTimeout(() => this.onerror?.(), 0); }
}

beforeEach(() => { vi.stubGlobal('Image', ImagemQueFalha); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('PDF do roteiro', () => {
  it('coordenada vira link para o app de mapa; sem coordenada, sem link', async () => {
    const saida = (await montarRoteiroPdf([
      { ordem: 1, produtor: 'Produtor A', propriedade: 'Lote A', telefone: '—', chegada: '07:40', trecho: '12 km', coordenadas: '-10.65432, -51.81234', lat: -10.654321, lng: -51.812345 },
      { ordem: 2, produtor: 'Produtor B', propriedade: 'Lote B', telefone: '—', chegada: '08:10', trecho: '3 km', coordenadas: '—' },
    ], ['Partida: Sede'], 'Rodapé.')).output();
    expect(saida).toContain('https://www.google.com/maps/search/?api=1&query=-10.654321,-51.812345');
    expect((saida.match(/google\.com\/maps\/search/g) || []).length).toBe(1);
  });

  it('não tem mais a coluna "Chegada prevista"', async () => {
    const saida = (await montarRoteiroPdf([
      { ordem: 1, produtor: 'Produtor A', propriedade: 'Lote A', telefone: '—', chegada: '07:40', trecho: '12 km', coordenadas: '-10.6, -51.8', lat: -10.6, lng: -51.8 },
    ], ['Partida: Sede'], 'Rodapé.')).output();
    expect(saida).not.toContain('Chegada prevista');
    expect(saida).toContain('Coordenadas');
  });
});
