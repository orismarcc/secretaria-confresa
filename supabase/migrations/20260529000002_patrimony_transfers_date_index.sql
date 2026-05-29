-- Index on transferred_at for ORDER BY performance
CREATE INDEX IF NOT EXISTS idx_patrimony_transfers_transferred_at
  ON patrimony_transfers(transferred_at DESC);

NOTIFY pgrst, 'reload schema';
