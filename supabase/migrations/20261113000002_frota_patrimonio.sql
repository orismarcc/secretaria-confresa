-- ============================================================================
-- Frotas × Patrimônio: o vínculo é OPCIONAL.
--  * Máquina/veículo PRÓPRIO continua exigindo o nº de patrimônio.
--  * Cedido, locado ou de consórcio pode não ter patrimônio (nº vazio).
--  * Pode (não precisa) apontar para o bem cadastrado em Patrimônio
--    (machinery.patrimony_id) — um bem só se liga a uma máquina.
-- Nenhum dado existente é alterado (hoje todos são próprios e têm nº).
-- ============================================================================

ALTER TABLE public.machinery ALTER COLUMN patrimony_number DROP NOT NULL;

ALTER TABLE public.machinery
  ADD COLUMN IF NOT EXISTS patrimony_id uuid REFERENCES public.patrimony(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS machinery_patrimony_id_key
  ON public.machinery (patrimony_id) WHERE patrimony_id IS NOT NULL;

-- Vazio vira nulo (cedido/locado sem patrimônio).
UPDATE public.machinery SET patrimony_number = NULL WHERE patrimony_number IS NOT NULL AND trim(patrimony_number) = '';

ALTER TABLE public.machinery DROP CONSTRAINT IF EXISTS machinery_patrimonio_proprio;
ALTER TABLE public.machinery ADD CONSTRAINT machinery_patrimonio_proprio
  CHECK (vinculo <> 'proprio' OR length(trim(COALESCE(patrimony_number, ''))) > 0);

NOTIFY pgrst, 'reload schema';
