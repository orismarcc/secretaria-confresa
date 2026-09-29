-- Precisão (em metros) de cada leitura de GPS do operador — para diagnosticar
-- casos como o ponto em Rio Branco-AC (29/09/2026). Só ACRESCENTA uma coluna
-- opcional; registros antigos ficam com NULL.
ALTER TABLE public.service_photos ADD COLUMN IF NOT EXISTS accuracy_m numeric;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_photos_accuracy_ok') THEN
    ALTER TABLE public.service_photos ADD CONSTRAINT service_photos_accuracy_ok
      CHECK (accuracy_m IS NULL OR accuracy_m >= 0);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
