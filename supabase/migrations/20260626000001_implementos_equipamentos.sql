-- ============================================================
-- Nova categoria de serviço: Implementos e Equipamentos
--   Tipos: Furador de Solo e Plantadeira
--   Manuseio pelo próprio produtor (sem operador/combustível)
-- ============================================================

-- 1. Permitir a nova categoria no CHECK
ALTER TABLE public.demand_types
  DROP CONSTRAINT IF EXISTS demand_types_category_check;

ALTER TABLE public.demand_types
  ADD CONSTRAINT demand_types_category_check
  CHECK (
    category IS NULL OR category = ANY (ARRAY[
      'patrulha_mecanizada', 'calcario', 'logistica_insumos',
      'entregas', 'assistencia_tecnica', 'implementos_equipamentos'
    ])
  );

-- 2. Criar os tipos de demanda (idempotente por nome)
INSERT INTO public.demand_types (name, category, is_active)
SELECT 'Furador de Solo', 'implementos_equipamentos', true
WHERE NOT EXISTS (SELECT 1 FROM public.demand_types WHERE name = 'Furador de Solo');

INSERT INTO public.demand_types (name, category, is_active)
SELECT 'Plantadeira', 'implementos_equipamentos', true
WHERE NOT EXISTS (SELECT 1 FROM public.demand_types WHERE name = 'Plantadeira');

NOTIFY pgrst, 'reload schema';
