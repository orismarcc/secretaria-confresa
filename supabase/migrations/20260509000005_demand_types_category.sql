-- Add category column to demand_types (was referenced in code but never migrated)
ALTER TABLE public.demand_types
  ADD COLUMN IF NOT EXISTS category text;

-- Back-fill category for existing rows whose names match known patterns
-- Uses ILIKE so it works regardless of case / punctuation the user typed
UPDATE public.demand_types SET category = 'patrulha_mecanizada'
  WHERE category IS NULL
    AND (name ILIKE '%patrulha%' OR name ILIKE '%mecanizada%' OR name ILIKE '%grade%' OR name ILIKE '% pc%' OR name ILIKE 'pc');

UPDATE public.demand_types SET category = 'calcario'
  WHERE category IS NULL
    AND (name ILIKE '%calc%rio%' OR name ILIKE '%calcario%');

UPDATE public.demand_types SET category = 'logistica_insumos'
  WHERE category IS NULL
    AND (name ILIKE '%insumo%' OR name ILIKE '%carga%descarga%');

UPDATE public.demand_types SET category = 'entregas'
  WHERE category IS NULL
    AND (name ILIKE '%entrega%');

UPDATE public.demand_types SET category = 'assistencia_tecnica'
  WHERE category IS NULL
    AND (name ILIKE '%assist%ncia%t%cnica%' OR name ILIKE '%assistencia%tecnica%' OR name ILIKE '%assistência%' OR name ILIKE '%at%cnica%');

-- Ensure "Assistência Técnica" demand type exists with the correct category.
-- If an existing row already has this name (any case), just update its category.
-- Otherwise insert a new active record.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.demand_types
    WHERE name ILIKE '%assist%ncia%t%cnica%' OR name ILIKE '%assistencia tecnica%'
  ) THEN
    UPDATE public.demand_types
      SET category = 'assistencia_tecnica', is_active = true
      WHERE name ILIKE '%assist%ncia%t%cnica%' OR name ILIKE '%assistencia tecnica%';
  ELSE
    INSERT INTO public.demand_types (name, description, category, is_active)
    VALUES ('Assistência Técnica', 'Serviços de assistência técnica rural', 'assistencia_tecnica', true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
