-- ============================================================
-- Controle de acesso de operadores por tipo de serviço
--   Cada operador pode ser restrito a tipos de demanda específicos.
--   Sem nenhuma linha = acesso a todos os tipos (retrocompatível).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.operator_demand_types (
  operator_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  demand_type_id uuid NOT NULL REFERENCES public.demand_types(id) ON DELETE CASCADE,
  created_at     timestamptz DEFAULT now(),
  PRIMARY KEY (operator_id, demand_type_id)
);

ALTER TABLE public.operator_demand_types ENABLE ROW LEVEL SECURITY;

-- Leitura: o próprio operador vê os seus; admin vê todos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'operator_demand_types' AND policyname = 'operator_demand_types_select'
  ) THEN
    CREATE POLICY "operator_demand_types_select" ON public.operator_demand_types
      FOR SELECT TO authenticated
      USING (operator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  END IF;

  -- Escrita (atribuição de acessos): somente admin
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'operator_demand_types' AND policyname = 'operator_demand_types_admin_write'
  ) THEN
    CREATE POLICY "operator_demand_types_admin_write" ON public.operator_demand_types
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Índices para as FKs
CREATE INDEX IF NOT EXISTS idx_operator_demand_types_operator_id
  ON public.operator_demand_types(operator_id);
CREATE INDEX IF NOT EXISTS idx_operator_demand_types_demand_type_id
  ON public.operator_demand_types(demand_type_id);

NOTIFY pgrst, 'reload schema';
