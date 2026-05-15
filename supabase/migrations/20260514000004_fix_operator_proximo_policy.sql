-- Fix: operators could not start/finalize services with status 'proximo'
-- The previous UPDATE policy only allowed 'pending' status or services
-- already assigned to the operator. 'proximo' was added later but the
-- policy was never updated to include it.

DROP POLICY IF EXISTS "Operators can update services" ON public.services;

CREATE POLICY "Operators can update services"
  ON public.services
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'operator'::app_role)
    AND (
      -- Allow starting a pending or scheduled (proximo) service
      status IN ('pending', 'proximo')
      OR
      -- Allow updating a service already assigned to this operator
      operator_id = auth.uid()
    )
  );
