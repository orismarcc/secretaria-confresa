

# Auditoria Completa: Bugs e Melhorias

## Bugs Identificados

### BUG 1: `worked_area` NÃO é persistida na edição de atendimento
Em `ServicesPage.tsx` linha 146, `handleEdit` não envia `worked_area` ao atualizar. Se o admin editar um atendimento, o valor da área é perdido.

### BUG 2: ServiceForm exige campos inexistentes no banco
O formulário (`ServiceForm.tsx`) exige com validação Zod campos como `purpose`, `machinery`, `operatorName`, `chassisCode` (todos obrigatórios com `.min()`), mas esses campos **não existem** na tabela `services` do banco. Resultado: os dados são coletados pelo formulário mas nunca salvos, e o admin é forçado a preencher campos inúteis. Além disso, `workedArea` tem validação `.min(0.01)` que impede salvar atendimentos sem área.

### BUG 3: `worked_area` é acessada com cast `(s as any).worked_area` na AnalyticsPage
O hook `useServices()` retorna dados tipados, mas o TypeScript gerado pelo Supabase provavelmente já inclui `worked_area`. O uso de `as any` mascara erros e pode quebrar silenciosamente.

### BUG 4: Login sempre redireciona para `/dashboard`
Em `LoginPage.tsx` linha 46, após login bem-sucedido, navega para `/dashboard` independentemente do role. Operadores são redirecionados para `/dashboard` e depois o `ProtectedRoute` os joga para `/operator` — causa flash visual e navegação desnecessária.

### BUG 5: `mapServiceForForm` passa `workedArea: 0` sempre
Na `ServicesPage.tsx` linha 222, ao editar um atendimento existente, `workedArea` é sempre `0` em vez de ler o valor real do banco (`s.worked_area`). O admin perde o valor cadastrado ao abrir o form de edição.

### BUG 6: Realtime duplicado
`DashboardPage` e `ServicesPage` ambos criam canais realtime para a tabela `services` — potencial de queries duplicadas e overhead.

---

## Melhorias Propostas

### MELHORIA 1: Limpar o ServiceForm — remover campos fantasma
Remover `purpose`, `machinery`, `operatorName`, `chassisCode`, `termSigned` e `latitude/longitude` do formulário e da validação Zod. Tornar `workedArea` opcional (`.min(0).optional()`). Esses campos não existem no banco e só confundem.

### MELHORIA 2: Persistir `worked_area` na edição
Adicionar `worked_area: data.workedArea || null` no `handleEdit` de `ServicesPage.tsx`.

### MELHORIA 3: Corrigir redirect pós-login
Usar a mesma lógica de `App.tsx`: redirecionar para `/operator` se role !== admin.

### MELHORIA 4: Corrigir `mapServiceForForm` para ler `worked_area` do banco
Mudar `workedArea: 0` para `workedArea: s.worked_area || 0`.

### MELHORIA 5: Remover casts `as any` na AnalyticsPage
Acessar `s.worked_area` diretamente se o tipo do Supabase já inclui o campo.

### MELHORIA 6: Exibir `worked_area` nos detalhes do atendimento (ServiceDetailView)
Atualmente, os detalhes do atendimento não mostram a área trabalhada cadastrada pelo admin. Adicionar esse campo na view.

### MELHORIA 7: Exibir `priority` no card do operador e nos detalhes
A prioridade é salva mas nunca exibida nos cards do operador nem nos detalhes do admin.

### MELHORIA 8: Tratamento de erro no login — traduzir mensagens do Supabase
Mensagens como "Invalid login credentials" aparecem em inglês.

---

## Plano de Implementação

1. **Limpar `ServiceForm.tsx`** — remover campos fantasma (`purpose`, `machinery`, `operatorName`, `chassisCode`, `termSigned`, coordenadas GPS), tornar `workedArea` opcional, simplificar schema Zod
2. **Corrigir `ServicesPage.tsx`** — adicionar `worked_area` no `handleEdit`; corrigir `mapServiceForForm` para ler `worked_area` do banco
3. **Corrigir `LoginPage.tsx`** — aguardar auth state change e redirecionar com base no role (ou simplesmente navegar para `/` e deixar o App resolver)
4. **Melhorar `ServiceDetailView.tsx`** — exibir área trabalhada e prioridade
5. **Limpar `AnalyticsPage.tsx`** — remover casts `as any`
6. **Traduzir erro de login** — mapear "Invalid login credentials" para "Email ou senha incorretos"
7. **Atualizar `types/index.ts`** — remover campos obsoletos da interface `Service`

