# Deploy na HostGator para `nahorafrota.tech`

Este projeto e um frontend `React + Vite` com backend no Supabase. Na HostGator, o deploy ideal e como site estatico.

## O que ja esta pronto

- O build de producao gera os arquivos em `dist/`
- O arquivo `public/.htaccess` ja existe e suporta rotas do React Router
- O frontend usa apenas variaveis publicas `VITE_*`

## 1. Gerar o build

No projeto:

```powershell
npm run build
```

Arquivos finais:

- `dist/index.html`
- `dist/assets/*`
- `dist/.htaccess`

## 2. Configurar o dominio na HostGator

No cPanel da HostGator:

1. Abra `Dominios` ou `Addon Domains`
2. Confirme que `nahorafrota.tech` aponta para a pasta publica correta
3. Descubra o `document root` do dominio

Observacao:

- Em alguns planos, o dominio principal usa `public_html/`
- Em outros casos, um dominio adicional usa uma subpasta, como `public_html/nahorafrota.tech/`

Publique os arquivos exatamente dentro do `document root` do dominio.

## 3. Fazer upload

No Gerenciador de Arquivos da HostGator ou por FTP:

1. Entre na pasta publica do dominio
2. Remova os arquivos antigos do site
3. Envie todo o conteudo de `dist/`

Importante:

- Envie os arquivos de dentro de `dist/`, nao a pasta `dist` como subpasta
- O `index.html` precisa ficar na raiz publicada
- O arquivo `.htaccess` tambem precisa ficar na raiz publicada

## 4. Configurar o Supabase para o dominio novo

No painel do Supabase, abra `Authentication -> URL Configuration` e ajuste:

- `Site URL`: `https://nahorafrota.tech`
- `Redirect URLs`:
  - `https://nahorafrota.tech/**`
  - `https://www.nahorafrota.tech/**`
  - `http://nahorafrota.tech/**`
  - `http://www.nahorafrota.tech/**`

Se voce nao usar `www`, ainda vale deixar cadastrado para evitar falhas em redirecionamentos.

## 5. SSL

Na HostGator:

1. Ative o SSL do dominio
2. Aguarde a emissao do certificado
3. Force redirecionamento para `https` se o painel oferecer essa opcao

## 6. Testes apos publicar

Teste no navegador:

- `https://nahorafrota.tech/`
- `https://nahorafrota.tech/login`
- `https://nahorafrota.tech/dashboard`
- atualizacao da pagina em uma rota interna
- login e logout

Se uma rota interna abrir em branco ou der `404`, normalmente o problema e o `.htaccess` fora da raiz publicada.

## 7. Checkout (Supabase + Stripe + Resend)

O site vende os planos sozinho. Antes de publicar, aplique a migration, publique as Edge Functions e configure os segredos conforme [docs/CHECKOUT.md](docs/CHECKOUT.md). Sem isso, o botão "Ir para o pagamento" responde "Pagamento ainda não configurado".

Teste depois de publicar: `https://nahorafrota.tech/comprar/control` → pagamento de teste do Stripe → `/comprar/sucesso` mostra o acesso → login → `/primeiro-acesso`.

## 8. Ponto de atencao

As páginas do painel carregam sob demanda; o site público baixa só o próprio código (a cena 3D do topo é um pacote separado, carregado depois). O painel ainda tem bundles grandes (mapas, gráficos), o que não bloqueia o deploy.
