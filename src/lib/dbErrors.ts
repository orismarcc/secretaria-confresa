/**
 * dbErrors.ts — traduz erros comuns do Supabase/Postgres/rede em mensagens
 * claras em português. Ajuda o usuário (e o diagnóstico) a entender o que
 * aconteceu — especialmente em celular, onde a mensagem crua é confusa.
 */
export function friendlyDbError(error: unknown): string {
  const err = error as any;
  const msg = (err?.message || String(err) || '').toString();
  const code = err?.code as string | undefined;

  // Rede (Safari/iOS usa "Load failed"; Chrome "Failed to fetch")
  if (/failed to fetch|load failed|networkerror|network request failed/i.test(msg)) {
    return 'Falha de conexão. Verifique sua internet e tente novamente.';
  }

  // CPF/CNPJ duplicado
  if (code === '23505' || /duplicate key|producers_cpf_key/i.test(msg)) {
    return 'Já existe um cadastro com este CPF/CNPJ. Use a busca para localizá-lo.';
  }

  // Permissão / RLS / sessão expirada
  if (
    code === '42501' ||
    /row-level security|violates row-level security|permission denied/i.test(msg)
  ) {
    return 'Sem permissão para esta ação, ou sua sessão expirou. Saia e entre novamente.';
  }

  // Autenticação / token
  if (/jwt|not authenticated|invalid token|401|refresh token/i.test(msg)) {
    return 'Sessão expirada. Saia e entre novamente para continuar.';
  }

  // UUID inválido (campo relacional vazio enviado como '')
  if (/invalid input syntax for type uuid/i.test(msg)) {
    return 'Há um campo de seleção inválido. Recarregue a página e tente novamente.';
  }

  return msg || 'Ocorreu um erro inesperado.';
}
