-- ============================================================
-- Glebas: subdivisões de assentamentos (paralelas às localidades).
--   Nem todo assentamento tem glebas.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.glebas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  settlement_id uuid NOT NULL REFERENCES public.settlements(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.glebas ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de settlements/locations: admin gerencia, autenticado visualiza
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='glebas' AND policyname='Admins can manage glebas') THEN
    CREATE POLICY "Admins can manage glebas" ON public.glebas
      FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='glebas' AND policyname='Glebas viewable by authenticated') THEN
    CREATE POLICY "Glebas viewable by authenticated" ON public.glebas
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_glebas_settlement_id ON public.glebas(settlement_id);

-- updated_at automático (função já existe no projeto)
DROP TRIGGER IF EXISTS set_glebas_updated_at ON public.glebas;
CREATE TRIGGER set_glebas_updated_at
  BEFORE UPDATE ON public.glebas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed dos exemplos (idempotente por nome+assentamento)
INSERT INTO public.glebas (name, settlement_id)
SELECT v.name, v.sid FROM (VALUES
  ('SANTA LUZIA', '4aa4688b-6736-4157-be7c-c6e72f3f77da'::uuid), -- PA CONFRESA RONCADOR
  ('ANGICÃO',     '2c1ff67f-0fe0-431e-bfbb-ea3c2d2f0792'::uuid), -- PA CANTA GALO
  ('PIETROBON',   '2c1ff67f-0fe0-431e-bfbb-ea3c2d2f0792'::uuid)  -- PA CANTA GALO
) AS v(name, sid)
WHERE NOT EXISTS (
  SELECT 1 FROM public.glebas g WHERE g.name = v.name AND g.settlement_id = v.sid
);

NOTIFY pgrst, 'reload schema';
