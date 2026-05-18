UPDATE public.demand_types
  SET category = 'logistica_insumos'
  WHERE name ILIKE '%carga%descarga%insumos%'
     OR name ILIKE 'Logística de carga e descarga de insumos';
