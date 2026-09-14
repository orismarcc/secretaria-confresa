-- ============================================================================
-- Combustível por MAQUINÁRIO.
--   1) machinery.fuel_type: tipo de combustível de cada máquina
--      (Diesel S10, Diesel S500, Gasolina). Opcional/retrocompatível.
--   2) machinery_refuels: registro de cada ABASTECIMENTO por máquina em litros,
--      feito pela equipe que abastece as máquinas no campo.
--
--   Aditivo e idempotente. Não altera fuel_usage (controle mensal agregado) nem
--   qualquer fluxo existente. RLS: admins gerenciam, autenticados leem.
-- ============================================================================

-- 1) Tipo de combustível da máquina --------------------------------------------
ALTER TABLE public.machinery
  ADD COLUMN IF NOT EXISTS fuel_type text;

-- 2) Abastecimentos por máquina ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.machinery_refuels (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machinery_id uuid NOT NULL REFERENCES public.machinery(id) ON DELETE CASCADE,
  liters       numeric(12,2) NOT NULL CHECK (liters >= 0),
  fuel_type    text,                          -- combustível abastecido (defina o da máquina por padrão)
  refueled_at  timestamptz NOT NULL DEFAULT now(),
  note         text,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_machinery_refuels_machinery
  ON public.machinery_refuels (machinery_id, refueled_at DESC);

ALTER TABLE public.machinery_refuels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage machinery_refuels" ON public.machinery_refuels;
CREATE POLICY "Admins can manage machinery_refuels"
  ON public.machinery_refuels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Machinery refuels viewable by authenticated" ON public.machinery_refuels;
CREATE POLICY "Machinery refuels viewable by authenticated"
  ON public.machinery_refuels FOR SELECT TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machinery_refuels TO authenticated;

NOTIFY pgrst, 'reload schema';
