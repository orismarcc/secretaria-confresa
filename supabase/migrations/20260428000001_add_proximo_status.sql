-- Adiciona 'proximo' como valor válido na constraint de status dos atendimentos
ALTER TABLE services
  DROP CONSTRAINT IF EXISTS services_status_check;

ALTER TABLE services
  ADD CONSTRAINT services_status_check
  CHECK (status IN ('pending', 'in_progress', 'completed', 'proximo'));
