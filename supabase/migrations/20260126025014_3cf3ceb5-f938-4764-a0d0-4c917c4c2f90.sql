-- Restrict producers table: operators can only see producers from their assigned services
DROP POLICY IF EXISTS "Admins and operators can view producers" ON public.producers;

-- Admins can view all producers
CREATE POLICY "Admins can view all producers" 
ON public.producers 
FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- Operators can only view producers they are actively servicing
CREATE POLICY "Operators can view assigned producers" 
ON public.producers 
FOR SELECT 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'operator') AND 
  id IN (
    SELECT producer_id FROM public.services 
    WHERE operator_id = auth.uid()
  )
);