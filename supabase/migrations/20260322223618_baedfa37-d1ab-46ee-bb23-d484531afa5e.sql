
-- Create machinery table
CREATE TABLE public.machinery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  patrimony_number TEXT NOT NULL,
  chassis TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.machinery ENABLE ROW LEVEL SECURITY;

-- Admins can manage machinery
CREATE POLICY "Admins can manage machinery"
  ON public.machinery FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can view machinery
CREATE POLICY "Machinery viewable by authenticated"
  ON public.machinery FOR SELECT
  TO authenticated
  USING (true);

-- Add operator_id and machinery_id columns to services table
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS machinery_id UUID REFERENCES public.machinery(id);
