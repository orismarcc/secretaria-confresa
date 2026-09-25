-- ============================================================================
-- CONECTA CONFRESA (Vitrine da Agricultura Familiar) — Fase 2
-- Coordenadas opcionais do fornecedor, para o mapa. Quando o fornecedor está
-- vinculado ao cadastro rural, o mapa usa as coordenadas de lá; estas servem
-- para quem não tem vínculo (ou para marcar o ponto de coleta/entrega).
-- Só altera a tabela vitrine_fornecedores (do próprio módulo). Idempotente.
-- ============================================================================

ALTER TABLE public.vitrine_fornecedores
  ADD COLUMN IF NOT EXISTS latitude  numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vitrine_fornecedores_coord_check') THEN
    ALTER TABLE public.vitrine_fornecedores
      -- Ambas vazias OU ambas preenchidas e válidas. (O IS NOT NULL explícito é
      -- necessário: CHECK com resultado NULL seria aceito pelo Postgres.)
      ADD CONSTRAINT vitrine_fornecedores_coord_check CHECK (
        (latitude IS NULL AND longitude IS NULL)
        OR (latitude IS NOT NULL AND longitude IS NOT NULL
            AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
