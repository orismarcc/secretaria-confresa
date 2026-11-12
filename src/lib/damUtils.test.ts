import { describe, it, expect } from 'vitest';
import { valorDamArrecadado, valorRestituido } from './damUtils';

describe('valorDamArrecadado (restituição da DAM)', () => {
  it('DAM paga de atendimento ativo conta inteira; não paga não conta', () => {
    expect(valorDamArrecadado({ dam_paid: true, dam_value: 500, status: 'completed' })).toBe(500);
    expect(valorDamArrecadado({ dam_paid: false, dam_value: 500, status: 'completed' })).toBe(0);
  });
  it('cancelado sem pedido de restituição não conta (regra anterior)', () => {
    expect(valorDamArrecadado({ dam_paid: true, dam_value: 500, status: 'cancelled' })).toBe(0);
  });
  it('cancelado com restituição pendente continua contando até confirmar', () => {
    expect(valorDamArrecadado({ dam_paid: true, dam_value: 500, status: 'cancelled', restituicao_status: 'pendente', restituicao_valor: 500 })).toBe(500);
  });
  it('restituição confirmada desconta o valor restituído', () => {
    const s = { dam_paid: true, dam_value: '500', status: 'cancelled', restituicao_status: 'confirmada', restituicao_valor: '500' };
    expect(valorDamArrecadado(s)).toBe(0);
    expect(valorRestituido(s)).toBe(500);
    expect(valorDamArrecadado({ ...s, restituicao_valor: 200 })).toBe(300);
  });
});
