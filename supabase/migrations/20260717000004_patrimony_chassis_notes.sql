-- Chassi (para veículos, opcional) e Observações (todos os bens) no patrimônio.
ALTER TABLE public.patrimony
  ADD COLUMN IF NOT EXISTS chassis text,
  ADD COLUMN IF NOT EXISTS notes text;

NOTIFY pgrst, 'reload schema';
