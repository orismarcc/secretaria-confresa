
-- 1. Fix services SELECT policy: public → authenticated
DROP POLICY IF EXISTS "Admins and operators can view services" ON public.services;
CREATE POLICY "Admins and operators can view services"
  ON public.services FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- 2. Fix services UPDATE policy for operators: public → authenticated
DROP POLICY IF EXISTS "Operators can update services" ON public.services;
CREATE POLICY "Operators can update services"
  ON public.services FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'operator'::app_role) AND ((status = 'pending'::text) OR (operator_id = auth.uid())));

-- 3. Fix producers SELECT policy for operators: public → authenticated
DROP POLICY IF EXISTS "Operators can view all producers" ON public.producers;
CREATE POLICY "Operators can view all producers"
  ON public.producers FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'operator'::app_role));

-- 4. Re-create the handle_new_user trigger (it exists as function but trigger is missing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
