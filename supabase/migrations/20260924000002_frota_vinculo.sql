-- ============================================================================
-- Frota: vínculo do maquinário/veículo — PRÓPRIO, CEDIDO (de outra secretaria
-- ou instituição), LOCADO ou de CONSÓRCIO. Para os não próprios: de quem
-- (opcional), data de admissão e data de término/validade.
-- Tudo que já existe fica como 'proprio'. Aditivo e idempotente.
-- ============================================================================

ALTER TABLE public.machinery
  ADD COLUMN IF NOT EXISTS vinculo        text NOT NULL DEFAULT 'proprio',
  ADD COLUMN IF NOT EXISTS vinculo_origem text,   -- cedente / locadora / consórcio
  ADD COLUMN IF NOT EXISTS vinculo_inicio date,   -- data de admissão
  ADD COLUMN IF NOT EXISTS vinculo_fim    date;   -- data de término / validade

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machinery_vinculo_check') THEN
    ALTER TABLE public.machinery
      ADD CONSTRAINT machinery_vinculo_check
      CHECK (vinculo IN ('proprio', 'cedido', 'locado', 'consorcio'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machinery_vinculo_periodo_check') THEN
    ALTER TABLE public.machinery
      ADD CONSTRAINT machinery_vinculo_periodo_check
      CHECK (vinculo_inicio IS NULL OR vinculo_fim IS NULL OR vinculo_fim >= vinculo_inicio);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
