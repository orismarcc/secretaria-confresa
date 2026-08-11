-- Odômetro (km) por evento e foto opcional.
ALTER TABLE public.service_photos
  ALTER COLUMN storage_path DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS odometer_km numeric(12,1);

NOTIFY pgrst, 'reload schema';
