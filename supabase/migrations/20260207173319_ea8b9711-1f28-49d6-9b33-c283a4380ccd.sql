-- Add worked_area column to services table for tracking area worked
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS worked_area numeric;

-- Add position column to services table for ordering pending services
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;

-- Add GPS coordinates to producers table for manual coordinate entry
ALTER TABLE public.producers ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.producers ADD COLUMN IF NOT EXISTS longitude numeric;

-- Create an index on position for faster ordering
CREATE INDEX IF NOT EXISTS idx_services_position ON public.services(position);

-- Update existing pending services with sequential positions based on created_at
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as new_position
  FROM public.services
  WHERE status = 'pending'
)
UPDATE public.services s
SET position = r.new_position
FROM ranked r
WHERE s.id = r.id;