-- Drop existing operator UPDATE policy
DROP POLICY IF EXISTS "Operators can update assigned services" ON public.services;

-- Create new policy: Operators can update any pending service (to start it) or their own in_progress service
CREATE POLICY "Operators can update services"
ON public.services
FOR UPDATE
USING (
  has_role(auth.uid(), 'operator'::app_role) 
  AND (
    -- Allow updating pending services (to assign to self)
    status = 'pending'
    OR 
    -- Allow updating their own in_progress services
    operator_id = auth.uid()
  )
);

-- Update the SELECT policy for services to allow operators to see all non-completed services
DROP POLICY IF EXISTS "Admins and operators can view services" ON public.services;

CREATE POLICY "Admins and operators can view services"
ON public.services
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR 
  has_role(auth.uid(), 'operator'::app_role)
);

-- Update producers policy so operators can see all producers (not just assigned ones)
DROP POLICY IF EXISTS "Operators can view assigned producers" ON public.producers;

CREATE POLICY "Operators can view all producers"
ON public.producers
FOR SELECT
USING (has_role(auth.uid(), 'operator'::app_role));