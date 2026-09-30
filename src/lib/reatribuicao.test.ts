import { describe, it, expect } from 'vitest';
import { escolherMaquina, historicoDeMaquinas } from './reatribuicao';

const V = { antoniel: ['pc01'], gil: ['yto', 'lonking'], semMaq: [] as string[] };
const GRADE = 'grade', PA = 'pa';
const hist = historicoDeMaquinas([
  { operator_id: 'gil', demand_type_id: GRADE, machinery_id: 'yto', status: 'completed' },
  { operator_id: 'gil', demand_type_id: GRADE, machinery_id: 'yto', status: 'completed' },
  { operator_id: 'gil', demand_type_id: GRADE, machinery_id: 'lonking', status: 'completed' }, // exceção
  { operator_id: 'gil', demand_type_id: PA, machinery_id: 'lonking', status: 'completed' },
  { operator_id: 'gil', demand_type_id: PA, machinery_id: 'yto', status: 'pending' },          // não finalizado: ignora
  { operator_id: 'gil', demand_type_id: 'roc', machinery_id: 'outra', status: 'completed' },   // máquina não vinculada: ignora
], V);

describe('escolherMaquina', () => {
  it('destino com uma máquina: ela acompanha o atendimento', () => {
    expect(escolherMaquina({ demand_type_id: 'pc', machinery_id: 'pc04' }, 'antoniel', V, hist))
      .toEqual({ machineryId: 'pc01', motivo: 'unica' });
  });
  it('destino com várias: escolhe pelo histórico do tipo de serviço', () => {
    expect(escolherMaquina({ demand_type_id: GRADE, machinery_id: null }, 'gil', V, hist))
      .toEqual({ machineryId: 'yto', motivo: 'historico' });
    expect(escolherMaquina({ demand_type_id: PA, machinery_id: 'pc01' }, 'gil', V, hist))
      .toEqual({ machineryId: 'lonking', motivo: 'historico' });
  });
  it('destino com várias e sem histórico do tipo: mantém a atual', () => {
    expect(escolherMaquina({ demand_type_id: 'roc', machinery_id: 'x' }, 'gil', V, hist))
      .toEqual({ machineryId: null, motivo: 'indefinida' });
  });
  it('destino sem máquina vinculada: mantém a atual', () => {
    expect(escolherMaquina({ demand_type_id: 'pc', machinery_id: 'pc04' }, 'semMaq', V, hist))
      .toEqual({ machineryId: null, motivo: 'sem_vinculo' });
  });
  it('já está com a máquina certa: nada a mudar', () => {
    expect(escolherMaquina({ demand_type_id: 'pc', machinery_id: 'pc01' }, 'antoniel', V, hist))
      .toEqual({ machineryId: null, motivo: 'ja_igual' });
  });
  it('empate no histórico: não decide', () => {
    const h2 = historicoDeMaquinas([
      { operator_id: 'gil', demand_type_id: GRADE, machinery_id: 'yto', status: 'completed' },
      { operator_id: 'gil', demand_type_id: GRADE, machinery_id: 'lonking', status: 'completed' },
    ], V);
    expect(escolherMaquina({ demand_type_id: GRADE }, 'gil', V, h2).motivo).toBe('indefinida');
  });
});
