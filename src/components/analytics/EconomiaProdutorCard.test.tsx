import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EconomiaProdutorCard } from './EconomiaProdutorCard';

// ResponsiveContainer (recharts) precisa de ResizeObserver no ambiente de teste.
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const tipos = [{ id: 'g', name: 'Grade' }, { id: 'p', name: 'PC' }];

describe('Economia do produtor (Análises)', () => {
  it('mostra a economia total e o comparativo por serviço', () => {
    render(
      <EconomiaProdutorCard
        exercicioLabel="Exercício 2026"
        demandTypes={tipos}
        services={[
          { status: 'completed', completed_at: '2026-03-10T12:00:00Z', demand_type_id: 'g', worked_hours: 4, fuel_liters: 20 },
          { status: 'completed', completed_at: '2026-04-10T12:00:00Z', demand_type_id: 'p', worked_hours: 5, fuel_liters: 100 },
        ]}
      />,
    );
    // particular: 4 h × 250 + 5 h × 400 = 3.000; Secretaria: 4 h × 165,22 + 5 h × 267,15 = 1.996,63
    expect(screen.getByText('O produtor rural economizou')).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s?1\.003/).length).toBeGreaterThan(0);
    expect(screen.getByText('Grade')).toBeInTheDocument();
    expect(screen.getByText('PC')).toBeInTheDocument();
  });

  it('sem Grade/PC com horas mostra aviso', () => {
    render(<EconomiaProdutorCard exercicioLabel="Exercício 2026" demandTypes={tipos} services={[]} />);
    expect(screen.getByText(/Nenhum atendimento de Grade ou PC/)).toBeInTheDocument();
  });
});
