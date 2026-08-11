-- Eventos de atendimento com foto (início, pausa, retomada, finalização).
-- Reaproveita service_photos + bucket service-photos. event_type distingue o
-- momento; o estado "pausado" é derivado do último evento (status permanece
-- in_progress, permitindo retomar depois).
ALTER TABLE public.service_photos
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS note text;

-- Fotos existentes vieram da finalização.
UPDATE public.service_photos SET event_type = 'finish' WHERE event_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_service_photos_service_captured
  ON public.service_photos (service_id, captured_at);

NOTIFY pgrst, 'reload schema';
