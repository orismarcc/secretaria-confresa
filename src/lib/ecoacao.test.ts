import { describe, it, expect } from 'vitest';
import {
  gerarProtocolo, pendencias, coordenadaValida, salvarDenuncia, listarDenuncias, apagarDenuncia,
  medidasReduzidas, alternarSugestao, CHAVE_ECOACAO, LIMITE_DENUNCIAS, type Denuncia,
} from './ecoacao';

function armazem(limiteBytes = Infinity) {
  const dados = new Map<string, string>();
  return {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (v.length > limiteBytes) throw new Error('QuotaExceededError');
      dados.set(k, v);
    },
  };
}

const denuncia = (id: string, extra: Partial<Denuncia> = {}): Denuncia => ({
  id, protocolo: `ECO-20261123-${id}`, tipo: 'descarte_lixo', criadaEm: '2026-11-23T10:00:00.000Z',
  fotoDataUrl: 'data:image/jpeg;base64,AAAA', latitude: -10.64, longitude: -51.56, precisaoM: 8,
  origemLocal: 'gps', endereco: '', descricao: 'Lixo jogado na beira da estrada', ...extra,
});

describe('EcoAção', () => {
  it('gera protocolo legível com a data', () => {
    expect(gerarProtocolo(new Date(2026, 10, 23), () => 0)).toBe('ECO-20261123-AAAA');
    expect(gerarProtocolo()).toMatch(/^ECO-\d{8}-[A-Z2-9]{4}$/);
  });

  it('valida coordenadas', () => {
    expect(coordenadaValida(-10.6, -51.5)).toBe(true);
    expect(coordenadaValida(0, 0)).toBe(false);
    expect(coordenadaValida(null, -51)).toBe(false);
    expect(coordenadaValida(120, 10)).toBe(false);
  });

  it('lista o que falta para enviar', () => {
    const vazio = { fotoDataUrl: '', latitude: null, longitude: null, endereco: '', descricao: '' };
    expect(pendencias(vazio)).toHaveLength(3);
    // endereço digitado substitui o GPS
    expect(pendencias({ ...vazio, fotoDataUrl: 'x', endereco: 'Rua das Flores, 120', descricao: 'Muito entulho na calçada' })).toEqual([]);
    expect(pendencias({ ...vazio, fotoDataUrl: 'x', latitude: -10.6, longitude: -51.5, descricao: 'curta' })).toEqual(['uma breve descrição (mín. 10 letras)']);
  });

  it('salva no aparelho, mais recente primeiro, e apaga', () => {
    const a = armazem();
    salvarDenuncia(denuncia('A'), a);
    salvarDenuncia(denuncia('B'), a);
    expect(listarDenuncias(a).map((d) => d.id)).toEqual(['B', 'A']);
    apagarDenuncia('A', a);
    expect(listarDenuncias(a).map((d) => d.id)).toEqual(['B']);
  });

  it('guarda no máximo o limite de denúncias', () => {
    const a = armazem();
    for (let i = 0; i < LIMITE_DENUNCIAS + 3; i++) salvarDenuncia(denuncia(`D${i}`), a);
    expect(listarDenuncias(a)).toHaveLength(LIMITE_DENUNCIAS);
  });

  it('sem espaço, descarta as mais antigas até caber', () => {
    const grande = 'data:image/jpeg;base64,' + 'X'.repeat(400);
    const a = armazem(1500);
    salvarDenuncia(denuncia('A', { fotoDataUrl: grande }), a);
    salvarDenuncia(denuncia('B', { fotoDataUrl: grande }), a);
    salvarDenuncia(denuncia('C', { fotoDataUrl: grande }), a);
    const ids = listarDenuncias(a).map((d) => d.id);
    expect(ids[0]).toBe('C');
    expect(ids).not.toContain('A');
  });

  it('dado corrompido no aparelho não quebra a página', () => {
    const a = armazem();
    a.setItem(CHAVE_ECOACAO, '{quebrado');
    expect(listarDenuncias(a)).toEqual([]);
    expect(listarDenuncias(null)).toEqual([]);
  });

  it('reduz a foto mantendo a proporção', () => {
    expect(medidasReduzidas(4000, 3000)).toEqual({ largura: 1280, altura: 960 });
    expect(medidasReduzidas(800, 600)).toEqual({ largura: 800, altura: 600 });
    expect(medidasReduzidas(0, 600)).toEqual({ largura: 0, altura: 0 });
  });
});

describe('EcoAção — sugestões da descrição', () => {
  it('acrescenta com maiúscula no início e vírgula entre itens', () => {
    expect(alternarSugestao('', 'Entulho de obra')).toBe('Entulho de obra');
    expect(alternarSugestao('Entulho de obra', 'Perto de rio ou córrego')).toBe('Entulho de obra, perto de rio ou córrego');
    expect(alternarSugestao('Sacos de lixo.', 'Pneus')).toBe('Sacos de lixo. Pneus');
  });
  it('tocar de novo retira do texto', () => {
    expect(alternarSugestao('Entulho de obra, perto de rio ou córrego', 'Perto de rio ou córrego')).toBe('Entulho de obra');
    expect(alternarSugestao('Entulho de obra, pneus', 'Entulho de obra')).toBe('Pneus');
    expect(alternarSugestao('Pneus', 'Pneus')).toBe('');
  });
  it('não confunde trecho de outra palavra', () => {
    expect(alternarSugestao('Pneus velhos', 'Pneus')).toBe('Pneus velhos, pneus');
  });
});
