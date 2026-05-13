-- Quantity of inputs (insumos) for "Logística de carga e descarga de insumos" demand type
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS input_quantity numeric(10,2);

NOTIFY pgrst, 'reload schema';
