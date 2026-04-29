-- Adiciona coluna de data de agendamento opcional nos atendimentos
ALTER TABLE services ADD COLUMN IF NOT EXISTS appointment_date date;

-- Reload schema cache after adding column
NOTIFY pgrst, 'reload schema';
