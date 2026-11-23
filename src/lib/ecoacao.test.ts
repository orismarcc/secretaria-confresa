import { describe, it, expect } from 'vitest';
import {
  gerarProtocolo, pendencias, coordenadaValida, salvarDenuncia, listarDenuncias, apagarDenuncia,
  medidasReduzidas, alternarSugestao, CHAVE_ECOACAO, LIMITE_DENUNCIAS, MAX_FOTOS, type Denuncia,
  melhorLeitura, leituraUtil, detectarPlataforma, navegadorDeApp, comoLiberarGps, type LeituraGps,
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
  fotos: ['data:image/jpeg;base64,AAAA'], latitude: -10.64, longitude: -51.56, precisaoM: 8,
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
    const vazio = { fotos: [] as string[], latitude: null, longitude: null, endereco: '', descricao: '' };
    expect(pendencias(vazio)).toHaveLength(3);
    // endereço digitado substitui o GPS
    expect(pendencias({ ...vazio, fotos: ['x'], endereco: 'Rua das Flores, 120', descricao: 'Muito entulho na calçada' })).toEqual([]);
    expect(pendencias({ ...vazio, fotos: ['x'], latitude: -10.6, longitude: -51.5, descricao: 'curta' })).toEqual(['uma breve descrição (mín. 10 letras)']);
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
    salvarDenuncia(denuncia('A', { fotos: [grande] }), a);
    salvarDenuncia(denuncia('B', { fotos: [grande] }), a);
    salvarDenuncia(denuncia('C', { fotos: [grande] }), a);
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

describe('EcoAção — fotos', () => {
  it('lê denúncia antiga (uma foto em fotoDataUrl) como lista de fotos', () => {
    const a = armazem();
    a.setItem(CHAVE_ECOACAO, JSON.stringify([{ id: 'V', protocolo: 'ECO-1', fotoDataUrl: 'data:x', descricao: 'antiga demais' }]));
    const [d] = listarDenuncias(a);
    expect(d.fotos).toEqual(['data:x']);
    expect('fotoDataUrl' in d).toBe(false);
  });
  it('nunca guarda mais que o máximo de fotos', () => {
    const a = armazem();
    a.setItem(CHAVE_ECOACAO, JSON.stringify([{ id: 'V', protocolo: 'ECO-1', fotos: ['1', '2', '3', '4'] }]));
    expect(listarDenuncias(a)[0].fotos).toHaveLength(MAX_FOTOS);
  });
});

describe('EcoAção — GPS', () => {
  const l = (precisaoM: number | null, em = 0, lat = -10.6): LeituraGps => ({ latitude: lat, longitude: -51.5, precisaoM, em });
  it('fica com a leitura mais precisa', () => {
    expect(melhorLeitura(l(80), l(15)).precisaoM).toBe(15);
    expect(melhorLeitura(l(15), l(80)).precisaoM).toBe(15);
    expect(melhorLeitura(null, l(300)).precisaoM).toBe(300);
  });
  it('troca por uma mais nova quase tão boa (a pessoa andou)', () => {
    expect(melhorLeitura(l(10, 0), l(20, 40_000, -10.7)).latitude).toBe(-10.7);
    expect(melhorLeitura(l(10, 0), l(200, 40_000, -10.7)).latitude).toBe(-10.6);
  });
  it('ignora coordenada inválida', () => {
    expect(melhorLeitura(l(50), { latitude: 0, longitude: 0, precisaoM: 1, em: 1 }).precisaoM).toBe(50);
  });
  it('leitura útil: precisa ser recente e razoável', () => {
    const agora = 1_000_000;
    expect(leituraUtil(l(30, agora - 1000), agora)).toBe(true);
    expect(leituraUtil(l(900, agora), agora)).toBe(false);
    expect(leituraUtil(l(30, agora - 5 * 60_000), agora)).toBe(false);
    expect(leituraUtil(null, agora)).toBe(false);
  });
  it('identifica o aparelho e o navegador de aplicativo', () => {
    expect(detectarPlataforma('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari')).toBe('iphone');
    expect(detectarPlataforma('Mozilla/5.0 (Linux; Android 14) Chrome')).toBe('android');
    expect(detectarPlataforma('Mozilla/5.0 (Windows NT 10.0) Chrome')).toBe('outro');
    expect(navegadorDeApp('Mozilla/5.0 (iPhone) Instagram 300')).toBe(true);
    expect(navegadorDeApp('Mozilla/5.0 (iPhone) Version/18 Mobile Safari')).toBe(false);
    expect(comoLiberarGps('iphone').join(' ')).toMatch(/Sites do Safari/);
  });
});
