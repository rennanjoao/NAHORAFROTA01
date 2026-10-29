# Na Hora Frota

Site público + painel de gestão de entregas e frota. React + Vite + Tailwind no frontend, Supabase (auth, banco, realtime, storage, Edge Functions) no backend, Stripe para a assinatura e Resend para o e-mail de acesso.

- **Site** (`/`): landing com 11 seções, dark/light, planos (Básico R$ 197 · Controle R$ 370 · Controle Total R$ 550) e checkout self-service. Código em `src/site/`.
- **Checkout → acesso na hora**: veja [docs/CHECKOUT.md](docs/CHECKOUT.md) (fluxo, deploy das funções, Stripe, Resend, testes).
- **Identidade visual**: `brand/` (manual, logos, tokens). Tema em `src/index.css`.
- **Painel** (`/dashboard`, `/deliveries`, …): app autenticado; `/` mostra o painel para quem já está logado.

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

4. Para o checkout sem Supabase/Stripe (funções em memória + caixa de e-mails):

```sh
deno run --allow-net --allow-env scripts/dev-backend/server.ts
```

Testes: `npm test` (frontend), `deno test --allow-env supabase/functions/_shared/handlers.test.ts` (funções) e `node scripts/e2e-checkout.cjs` (compra inteira no navegador, com os dois servidores no ar).

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
