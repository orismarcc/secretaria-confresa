-- Allow all authenticated users to read profiles.
-- Required so that the profiles!operator_id(name) join in usePendingServices
-- returns the operator name even when the querying user is not the same as the operator.
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
