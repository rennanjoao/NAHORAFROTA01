# Na Hora Frota

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

## Deploy na Vercel

O `vercel.json` ja define o build (`npm run build`, pasta `dist`) e manda todas as rotas
para o `index.html` (sem isso, abrir ou recarregar `/deliveries` daria 404).

1. Importe este repositorio na Vercel (o que tem a pasta `src/`). Root Directory: vazio.
2. Em Settings > Environment Variables (marque Production e Preview):

   | Variavel | Valor | Obrigatoria |
   |---|---|---|
   | `VITE_SUPABASE_URL` | Supabase > Project Settings > API > Project URL | sim |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase > Project Settings > API Keys > `anon` `public` | sim |
   | `VITE_MAPBOX_TOKEN` | token publico do Mapbox | nao (sem ele o mapa usa OpenStreetMap) |

   `VITE_SUPABASE_PROJECT_ID` nao e usada pelo codigo. As variaveis `VITE_*` entram no
   build: depois de criar ou mudar uma, faca Redeploy.
3. No Supabase:
   - Edge Functions > Secrets: `ALLOWED_ORIGINS` com o endereco da Vercel (ex.:
     `https://nahorafrota-app.vercel.app`; varios separados por virgula). Sem isso o
     cadastro de empresa, de usuarios e de motoristas falha pelo endereco `.vercel.app`.
     `nahorafrota.tech` e `www.nahorafrota.tech` ja sao aceitos.
   - Authentication > URL Configuration: Site URL com o endereco final e, em Redirect URLs,
     `https://SEU-ENDERECO/reset-password` (recuperacao de senha).

## Banco e Edge Functions (Supabase)

Ordem de publicacao: primeiro o banco, depois as functions e por ultimo o frontend.

1. Atualize o banco com um arquivo so: no Supabase, abra SQL Editor > New query, cole
   `supabase/ATUALIZAR_BANCO.sql` inteiro e clique em Run. Ele roda numa transacao (se algo
   falhar, nada e gravado), pode ser rodado de novo sem duplicar nada e confere antes se o
   banco tem a base do projeto. Junta, na ordem, as migrations que podem faltar:
   - `20260526003000`, `20260527100000` e `20260527103000` (inicio do plano, isolamento entre
     empresas e status do plano; provavelmente ja aplicadas, reaplicar nao muda nada);
   - `20261028120000_trial_billing_funnel_and_ops.sql` (trial de 7 dias, funil, avisos de
     cobranca, chegada por raio, auto-finalizacao de romaneio e permissoes);
   - `20261028130000_fix_driver_access_rpcs_and_realtime.sql` (acesso do app do motorista,
     fotos de comprovante para a equipe, RPCs com checagem de empresa, realtime, troca de
     nivel de acesso, ordem das paradas, finalizar/excluir romaneio, carteira do motorista,
     bloqueio por atraso e limites do plano iguais aos da tela).

   Quem usa a CLI pode rodar `supabase db push` no lugar. Ao criar uma migration nova,
   inclua o nome dela em `supabase/gerar_atualizacao.sh` e rode o script para gerar o
   arquivo de novo (os testes abaixo avisam se ele ficou desatualizado).
2. Publique as edge functions alteradas/novas: `register-tenant`, `create-user`,
   `invite-user`, `create-driver`, `update-user-access` e `send-driver-credentials`
   (todas usam a pasta `_shared`).
3. Configure os segredos das functions (Supabase > Edge Functions > Secrets) para o e-mail
   de dados de acesso do motorista:
   - `RESEND_API_KEY`: chave da API do [Resend](https://resend.com)
   - `RESEND_FROM_EMAIL`: remetente verificado, ex.: `Na Hora Frota <nao-responda@nahorafrota.tech>`
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
