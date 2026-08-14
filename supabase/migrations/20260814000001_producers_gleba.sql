-- ============================================================
-- Produtores: vínculo opcional a uma gleba (subdivisão do assentamento).
--   A gleba pertence a um assentamento (glebas.settlement_id) e é escolhida
--   no cadastro do produtor a partir das glebas daquele assentamento.
-- ============================================================

ALTER TABLE public.producers
  ADD COLUMN IF NOT EXISTS gleba_id uuid REFERENCES public.glebas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_producers_gleba_id ON public.producers(gleba_id);

NOTIFY pgrst, 'reload schema';
