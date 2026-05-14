-- Add responsible_technician_id to delivery_lots
ALTER TABLE public.delivery_lots
  ADD COLUMN IF NOT EXISTS responsible_technician_id UUID
    REFERENCES public.responsible_technicians(id) ON DELETE SET NULL;
