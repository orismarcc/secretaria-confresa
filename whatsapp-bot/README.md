# Bot de WhatsApp — Resumo diário de atendimentos

Envia, **1× por dia** no horário definido, o resumo do Dashboard (**Próximos
Atendimentos** + **Em Execução**, por operador) para os colaboradores
cadastrados no `recipients.json`. Cada operador recebe a sua parte; quem estiver
com `"all": true` recebe o resumo completo.

> ⚠️ **Solução não oficial** (biblioteca [Baileys](https://github.com/WhiskeySockets/Baileys)):
> conecta como um "aparelho vinculado" do WhatsApp, igual ao WhatsApp Web. Para
> uso interno e baixo volume o risco é baixo, mas o WhatsApp pode bloquear o
> número. **Use um número dedicado da secretaria** (não o pessoal).

## Pré‑requisitos
- Um computador que **fique sempre ligado** (o bot precisa manter a sessão viva).
  Pode ser um PC da secretaria, um mini‑PC/Raspberry Pi, ou um servidorzinho.
- Node.js 18+ instalado.
- Um celular com o WhatsApp do número que fará os envios (para escanear o QR uma vez).

## Instalação
```bash
cd whatsapp-bot
npm install
cp .env.example .env               # preencha SUPABASE_* e o horário
cp recipients.example.json recipients.json   # preencha nomes e telefones
```
No `.env`, use a **chave service_role** (a mesma do `.env.local` do projeto).
Nos telefones, use o formato internacional só com dígitos: `55` + DDD + número
(ex.: `5566999998888`).

## Primeiro uso — conectar o WhatsApp da secretaria (só 1 vez)
Você conecta como um "aparelho vinculado" (igual WhatsApp Web). Use o **número
da secretaria** (dedicado, não o pessoal). Duas formas:

**A) Por QR Code** (mais simples se a máquina tem tela):
```bash
npm start
```
Aparece um QR no terminal. No celular com o WhatsApp da secretaria:
**Configurações → Aparelhos conectados → Conectar aparelho** e escaneie.

**B) Por código de 8 dígitos** (melhor em servidor sem tela / acesso remoto):
No `.env`, defina `PAIR_PHONE=5566999998888` (número da secretaria, só dígitos) e:
```bash
npm start
```
O terminal mostra um **código de 8 dígitos**. No celular:
**Aparelhos conectados → Conectar aparelho → "Conectar com número de telefone"**
e digite o código.

Depois de conectar, a sessão fica salva em `auth/` e **não pede de novo**. Se o
WhatsApp desconectar (raro), apague a pasta `auth/` e refaça o pareamento.

## Testar o envio na hora
```bash
npm run test-now
```
Envia o resumo imediatamente para todos do `recipients.json` (bom para conferir
o formato antes de deixar no automático).

## Duas formas de rodar (escolha uma)

Você **não precisa** deixar o PC ligado 24/7. A sessão do WhatsApp fica salva em
`auth/`, então dá para desligar à noite e ligar de manhã **sem escanear de novo**.

### Opção 1 — Ligar o PC de manhã e enviar uma vez (mais simples) ✅
O bot conecta, envia o resumo e **fecha**. Basta o PC estar ligado na hora.
```bash
npm run once
```
Para ser automático ao ligar o PC (Windows), agende no **Agendador de Tarefas**:
- Ação: `Iniciar um programa` → programa `node`, argumentos `index.js --once`,
  "Iniciar em" = a pasta `whatsapp-bot`.
- Disparador: `Ao fazer logon` (ou num horário fixo, ex.: 07:05).
Assim: você chega, liga o PC, o bot conecta e manda a mensagem sozinho.

### Opção 2 — Deixar rodando o dia todo (envia no horário SEND_AT)
Fica no ar e dispara sozinho todo dia no horário definido. Precisa do PC ligado
naquele horário.
```bash
npm install -g pm2
pm2 start index.js --name whatsapp-bot
pm2 save
pm2 startup      # inicia junto com o sistema
```
Logs: `pm2 logs whatsapp-bot`.

> Dica: na Opção 1 o `SEND_AT` é ignorado (envia assim que conecta). Na Opção 2
> ele é o horário do disparo diário.

## Como funciona / configuração
- **Horário:** `SEND_AT` (ex.: `07:00`) e `TIMEZONE` (ex.: `America/Cuiaba`) no `.env`.
- **Destinatários:** `recipients.json` — lista de `{ match, phone, all }`.
  - `match`: parte do nome do operador (ex.: `"Gil"`). O bot casa pelo nome que
    aparece no Dashboard.
  - `all: true`: recebe o resumo completo (todos os operadores) — útil para a coordenação.
- **Fonte dos dados:** lê direto do Supabase os atendimentos com status
  `proximo` (Próximos) e `in_progress` (Em Execução).

## Segurança
- `.env`, `recipients.json` e `auth/` **não** vão para o Git (já no `.gitignore`).
- A chave service_role dá acesso total ao banco — guarde o `.env` com cuidado e
  rode o bot só numa máquina de confiança.
