-- Adiciona campos de DAM (Documento de Arrecadação Municipal) nos atendimentos
-- dam_issued: se a DAM foi emitida
-- dam_paid: se a DAM foi paga
-- dam_issued_at: data em que a DAM foi emitida (para calcular atraso de 30 dias)
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS dam_issued boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dam_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dam_issued_at date;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
