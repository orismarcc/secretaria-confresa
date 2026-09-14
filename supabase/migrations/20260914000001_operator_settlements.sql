-- ============================================================
-- Controle de acesso de operadores por ASSENTAMENTO.
--   Cada operador pode ser restrito a assentamentos específicos.
--   Sem nenhuma linha = acesso a todos os assentamentos (retrocompatível).
--   Espelha public.operator_demand_types (mesmo padrão de RLS e índices).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.operator_settlements (
  operator_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settlement_id uuid NOT NULL REFERENCES public.settlements(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),
  PRIMARY KEY (operator_id, settlement_id)
);

ALTER TABLE public.operator_settlements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Leitura: o próprio operador vê os seus; admin vê todos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'operator_settlements' AND policyname = 'operator_settlements_select'
  ) THEN
    CREATE POLICY "operator_settlements_select" ON public.operator_settlements
      FOR SELECT TO authenticated
      USING (operator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  END IF;

  -- Escrita (atribuição de acessos): somente admin
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'operator_settlements' AND policyname = 'operator_settlements_admin_write'
  ) THEN
    CREATE POLICY "operator_settlements_admin_write" ON public.operator_settlements
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Índices para as FKs
CREATE INDEX IF NOT EXISTS idx_operator_settlements_operator_id
  ON public.operator_settlements(operator_id);
CREATE INDEX IF NOT EXISTS idx_operator_settlements_settlement_id
  ON public.operator_settlements(settlement_id);

NOTIFY pgrst, 'reload schema';
