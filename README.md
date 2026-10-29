# NaHoraFrota

Aplicacao web em React + Vite com Supabase para autenticacao, banco, realtime e storage.

## Rodando localmente

1. Instale as dependencias:

```sh
npm install
```

2. Crie o arquivo `.env` com base em `.env.example`.

3. Rode o projeto:

```sh
npm run dev
```

## Variaveis de ambiente

Este projeto usa as seguintes variaveis publicas do frontend:

```env
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=
```

Importante:

- Use apenas a chave publica/anon do Supabase no frontend.
- Nunca coloque `service_role` no `.env` do Vite.

## Banco e Edge Functions (Supabase)

Ordem de publicacao: primeiro o banco, depois as functions e por ultimo o frontend.

1. Aplique as migrations, nesta ordem (as duas sao idempotentes):
   - `supabase/migrations/20261028120000_trial_billing_funnel_and_ops.sql` (trial de 7 dias,
     funil, avisos de cobranca, chegada por raio, auto-finalizacao de romaneio e permissoes);
   - `supabase/migrations/20261028130000_fix_driver_access_rpcs_and_realtime.sql` (acesso do
     app do motorista, fotos de comprovante para a equipe, RPCs com checagem de empresa,
     realtime, troca de nivel de acesso, ordem das paradas, finalizar/excluir romaneio,
     carteira do motorista, bloqueio por atraso e limites do plano iguais aos da tela).
2. Publique as edge functions alteradas/novas: `register-tenant`, `create-user`,
   `invite-user`, `create-driver`, `update-user-access` e `send-driver-credentials`
   (todas usam a pasta `_shared`).
3. Configure os segredos das functions (Supabase > Edge Functions > Secrets) para o e-mail
   de dados de acesso do motorista:
   - `RESEND_API_KEY`: chave da API do [Resend](https://resend.com)
   - `RESEND_FROM_EMAIL`: remetente verificado, ex.: `NaHora Frota <nao-responda@nahorafrota.tech>`
   - `APP_URL` (opcional): padrao `https://nahorafrota.tech`

   Sem esses segredos o cadastro do motorista funciona normalmente e o painel avisa que o
   e-mail nao foi enviado.
4. Recuperacao de senha ("Esqueci minha senha"): em Supabase > Authentication > URL
   Configuration, inclua `https://SEU-DOMINIO/reset-password` em "Redirect URLs". O e-mail de
   recuperacao usa o SMTP configurado no Supabase (o padrao tem limite baixo de envios; para
   producao configure um SMTP proprio, por exemplo o do Resend).

Para conferir as regras em um Postgres local descartavel (nunca em producao):

```sh
PGURL=postgres://postgres@localhost:5432/postgres ./supabase/tests/run.sh
```

Regras de acesso aplicadas pelo banco:

- Empresa nova entra em teste gratis de 7 dias; ao fim, o banco deixa de servir os dados
  ate o Super Admin ativar a assinatura ou estender o teste (+7 dias, no painel Master).
- O teste gratis e liberado uma unica vez por CNPJ da empresa e por CPF/CNPJ de cobranca.
- Plano, status, trial, vencimento e documento de cobranca so mudam pelo Super Admin.
- Dados da empresa, usuarios e niveis de acesso so mudam pelo Administrador da empresa.
- Arquivos de documentos do motorista so abrem para o Super Admin.

## Build de producao

Para gerar os arquivos prontos para hospedagem:

```sh
npm run build
```

Os arquivos finais serao gerados em `dist/`.

## Deploy na HostGator

Este projeto pode ser publicado como site estatico na HostGator, mantendo o backend no Supabase.

### 1. Gere o build

```sh
npm run build
```

### 2. Confirme o arquivo `.htaccess`

O arquivo `public/.htaccess` ja foi preparado para que o React Router funcione em hospedagem Apache.

Durante o build, ele sera copiado para `dist/.htaccess`.

### 3. Envie os arquivos para o servidor

No cPanel da HostGator:

1. Abra o Gerenciador de Arquivos.
2. Entre na pasta `public_html/` do dominio.
3. Apague os arquivos antigos do site.
4. Envie todo o conteudo da pasta `dist/`.

Importante:

- Envie os arquivos de dentro de `dist/`, nao a pasta `dist` como subpasta.
- O arquivo `index.html` precisa ficar na raiz publicada.

### 4. Teste as rotas

Depois do upload, teste:

- `/`
- `/login`
- `/tracker`
- `/dashboard`

Se o `.htaccess` estiver correto, atualizar a pagina em rotas internas nao deve gerar erro 404.

## O que fica fora da HostGator

A HostGator vai servir o frontend. O Supabase continua responsavel por:

- autenticacao
- banco de dados
- realtime
- storage

Se voce quiser migrar tambem o backend no futuro, isso exigira uma migracao separada.
