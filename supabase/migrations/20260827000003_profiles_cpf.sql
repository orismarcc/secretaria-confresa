-- ============================================================
-- CPF nos usuários (profiles) + permissão de admin para editar.
--   Campo opcional. Admins podem ver (já podiam) e agora também editar o CPF
--   de qualquer usuário, para a gestão de colaboradores.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf text;

-- Admins podem atualizar qualquer profile (nome/CPF) — gestão de usuários.
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

NOTIFY pgrst, 'reload schema';
