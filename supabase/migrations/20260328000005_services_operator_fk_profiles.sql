-- Fix: redirect services.operator_id FK from auth.users → public.profiles
-- so PostgREST can join profiles!operator_id(name) without a 400 error.
-- profiles.id is always equal to auth.users.id (set by a trigger on signup),
-- so data integrity is maintained.

ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_operator_id_fkey;

ALTER TABLE public.services
  ADD CONSTRAINT services_operator_id_fkey
  FOREIGN KEY (operator_id) REFERENCES public.profiles(id)
  ON DELETE SET NULL;
