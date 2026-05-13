-- Migrate existing GTA records to 'Outros' (data preservation)
UPDATE sefaz_services
  SET service_type = 'Outros'
  WHERE service_type = 'GTA';

-- Drop any previous check constraint (idempotent)
ALTER TABLE sefaz_services
  DROP CONSTRAINT IF EXISTS sefaz_services_service_type_check;

-- Enforce only the three valid service types
ALTER TABLE sefaz_services
  ADD CONSTRAINT sefaz_services_service_type_check
  CHECK (service_type IN ('Nota Fiscal', 'Declaração de Posse', 'Outros'));

NOTIFY pgrst, 'reload schema';
