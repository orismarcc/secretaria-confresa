-- operation_type: classificação estável para gráficos comparativos,
-- substituindo a detecção frágil por substring de nome.
ALTER TABLE demand_types
  ADD COLUMN IF NOT EXISTS operation_type text
  CHECK (operation_type IN ('grade', 'pc', 'pa_carregadeira'));

-- Backfill a partir dos nomes atuais
UPDATE demand_types SET operation_type = 'grade'
WHERE operation_type IS NULL AND name ILIKE '%grade%';

UPDATE demand_types SET operation_type = 'pa_carregadeira'
WHERE operation_type IS NULL AND name ILIKE '%carregadeira%';

UPDATE demand_types SET operation_type = 'pc'
WHERE operation_type IS NULL AND (UPPER(TRIM(name)) = 'PC' OR name ILIKE '% pc%' OR name ILIKE 'pc %');

NOTIFY pgrst, 'reload schema';
