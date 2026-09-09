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
