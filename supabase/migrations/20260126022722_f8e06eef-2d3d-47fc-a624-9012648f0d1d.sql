-- Add is_active column to user_roles table for operator status
ALTER TABLE public.user_roles 
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- Create a function to check if there are any admins in the system
CREATE OR REPLACE FUNCTION public.has_any_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  )
$$;

-- Create a function to promote first user to admin (bootstrap)
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(_user_id uuid)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only promote if there are no admins yet
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (_user_id, 'admin', true)
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;