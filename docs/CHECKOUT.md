# Checkout, acesso automático e cobrança

Fluxo: **site → plano → dados da empresa → pagamento → empresa + administrador criados → login e senha enviados por e-mail e mostrados na tela → primeiro acesso troca a senha**.

## Peças

| Onde | O quê |
|---|---|
| `src/site/` | Landing (11 seções), checkout (`/comprar/:plano`), pagamento de teste (`/checkout/sandbox/:pedido`), sucesso (`/comprar/sucesso`), termos e privacidade. |
| `src/config/plans.ts` | Planos e preços do site (Básico 197 · Controle 370 · Controle Total 550). |
| `supabase/functions/_shared/plans.ts` | Espelho dos planos no servidor. **O valor cobrado sai daqui**, nunca do navegador. O teste `src/config/plans.test.ts` falha se os dois divergirem. |
| `supabase/functions/create-checkout` | Valida os dados, recusa CNPJ/e-mail já cadastrados, grava o pedido e abre o pagamento (Stripe Checkout ou, em teste, a página sandbox). |
| `supabase/functions/stripe-webhook` | Recebe `checkout.session.completed` (cria empresa + admin + envia acesso), `invoice.paid` (renova vencimento), `invoice.payment_failed`, `customer.subscription.deleted` (bloqueia). Assinatura verificada com HMAC. |
| `supabase/functions/get-order` | A tela de sucesso consulta o pedido com um token próprio (hash no banco). Mostra a senha temporária por 72 h. |
| `supabase/functions/confirm-sandbox-payment` | Só funciona com `CHECKOUT_MODE=sandbox` e sem chave do Stripe. |
| `supabase/functions/resend-access` | Painel Master → "Reenviar acesso": nova senha temporária + e-mail. Exige sessão de admin da plataforma. |
| `supabase/migrations/20261029120000_checkout_orders.sql` | Tabela `orders` (RLS: só admin da plataforma lê), colunas de cobrança em `tenants`, limites por plano. |
| `src/pages/PrimeiroAcessoPage.tsx` | Troca obrigatória da senha temporária (`user_metadata.must_change_password`). |
| `src/components/master/OrdersCard.tsx` | Lista de pedidos no Painel Master com reenvio de acesso. |

## Publicar no Supabase

```bash
npm i -g supabase            # ou npx supabase ...
supabase login
supabase link --project-ref mhnzhwqroyyxpbxrylax
supabase db push             # aplica a migration dos pedidos
supabase functions deploy create-checkout get-order confirm-sandbox-payment stripe-webhook resend-access
```

Segredos das funções (Dashboard → Edge Functions → Secrets, ou `supabase secrets set`):

| Variável | Valor |
|---|---|
| `SITE_URL` | `https://nahorafrota.tech` |
| `CHECKOUT_MODE` | `stripe` em produção. `sandbox` só para testar sem cobrar (nunca junto com chave do Stripe). |
| `STRIPE_SECRET_KEY` | `sk_live_…` (ou `sk_test_…` para homologar) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` do endpoint abaixo |
| `RESEND_API_KEY` | chave da Resend (envio do e-mail de acesso). Sem ela, o acesso continua aparecendo na tela de sucesso. |
| `EMAIL_FROM` | `Na Hora Frota <acesso@nahorafrota.tech>` (domínio verificado na Resend) |
| `SUPPORT_EMAIL` | `suporte@nahorafrota.com.br` |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem nas Edge Functions.

## Stripe

1. Ative **cartão** (e, se quiser, **boleto**) em Configurações → Métodos de pagamento. A assinatura é mensal em BRL, criada com `price_data` na hora (não precisa cadastrar produtos).
2. Developers → Webhooks → **Add endpoint**: `https://mhnzhwqroyyxpbxrylax.supabase.co/functions/v1/stripe-webhook`, eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`. Copie o `whsec_…` para `STRIPE_WEBHOOK_SECRET`.
3. Para testar ponta a ponta com cartão de teste (`4242 4242 4242 4242`), use `sk_test_…` + webhook de teste. Para testar sem Stripe, `CHECKOUT_MODE=sandbox`.

## Resend (e-mail de acesso)

Crie a conta, verifique o domínio `nahorafrota.tech` (registros DNS que a Resend mostra) e gere a chave. O e-mail sai de `EMAIL_FROM` com `reply_to` no suporte. O HTML fica em `supabase/functions/_shared/notify.ts`.

## Rodar tudo localmente (sem Supabase, sem Stripe)

```bash
deno run --allow-net --allow-env scripts/dev-backend/server.ts   # funções em memória na porta 54321
npm run dev                                                        # site em http://localhost:8080
node scripts/e2e-checkout.cjs                                      # percorre a compra inteira no navegador
```

`.env.local` já aponta `VITE_FUNCTIONS_URL` para o servidor local. E-mails "enviados" ficam em `http://localhost:54321/dev/outbox`; o estado do banco em `/dev/state`.

Testes das funções: `deno test --allow-env supabase/functions/_shared/handlers.test.ts`.

## O que acontece quando o cliente paga

1. Stripe confirma → webhook → pedido vira `paid`.
2. `provisionOrder`: cria usuário (e-mail confirmado, senha temporária, `must_change_password`), empresa ativa no plano com vencimento em 1 mês, perfil, papel `admin`, vínculo e registro em `payment_history`. Qualquer falha desfaz tudo e marca o pedido como `failed` com o motivo (aparece no Painel Master).
3. `sendAccessEmail`: e-mail com login, senha temporária e link de entrada.
4. A tela de sucesso (que fica consultando `get-order`) mostra as três etapas, o login, a senha temporária (com copiar/mostrar), o status do e-mail, "Entrar agora" e "Salvar no meu WhatsApp".
5. No primeiro login o sistema força `/primeiro-acesso` para criar a senha definitiva.
6. Todo mês: `invoice.paid` estende `next_due_date`; falha de pagamento marca `financial_status = pending`; cancelamento bloqueia a empresa.
