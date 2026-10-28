# Na Hora Frota — Identidade visual

Pasta oficial da marca. Tudo que está aqui segue o **Manual da Marca** (`manual-da-marca.html`, abra no navegador).

## O que tem aqui

| Pasta / arquivo | Conteúdo |
|---|---|
| `manual-da-marca.html` | Manual completo: estratégia, logo, cores, tipografia, elementos, voz, aplicações e linha de criação. |
| `logo/svg/` | Logos em vetor com o texto convertido em curvas (abre em Illustrator, Figma, Corel, Inkscape). |
| `logo/png/` | Os mesmos logos em PNG com fundo transparente (1x e 2x). |
| `icones/` | Ícone de app (escuro, verde, claro, maskable), avatar e favicon. |
| `padroes/` | Padrão chevron e linhas de rota (versões escura e clara). |
| `tokens/` | `nhf-tokens.css`, `nhf-colors.json` e `tailwind.colors.js` para usar no código. |
| `mockups/` | Artes em PNG 300 dpi no tamanho físico de cada aplicação e prompts para gerar mockups fotorrealistas (Higgsfield, Midjourney, Photoshop). |

## Qual logo usar

| Situação | Arquivo |
|---|---|
| Padrão, fundo preto ou escuro | `nhf-logo-horizontal-cor-fundo-escuro` |
| Fundo branco ou claro | `nhf-logo-horizontal-cor-fundo-claro` |
| Barra de navegação, rodapé, faixa estreita | `nhf-logo-linha-*` |
| Adesivo, camiseta, formato quadrado | `nhf-logo-vertical-*` |
| Ícone de app, favicon, avatar, marcador de mapa | `nhf-simbolo-*` ou `icones/` |
| Uma cor só (bordado, corte, carimbo, foto) | `*-mono-branco`, `*-mono-preto` ou `*-mono-verde` |

Regras rápidas: nunca verde sobre branco; nunca digitar o nome com fonte; área de proteção = altura do símbolo ÷ 4; tamanho mínimo do logo horizontal = 140 px / 35 mm.

## Nomenclatura

`nhf-[tipo]-[arranjo]-[cor].[ext]`

- tipo: `logo`, `wordmark`, `simbolo`, `app-icon`, `avatar`, `favicon`, `padrao`
- arranjo: `horizontal`, `linha`, `vertical` (ou nenhum)
- cor: `cor-fundo-escuro`, `cor-fundo-claro`, `mono-branco`, `mono-preto`, `mono-verde`, `verde`, `branco`, `preto`

## Cores

| Nome | HEX | Uso |
|---|---|---|
| Verde Na Hora | `#04E8A4` | destaque, status "no prazo", CTA, símbolo |
| Preto Asfalto | `#080808` | fundo principal |
| Branco | `#FFFFFF` | texto sobre preto, papelaria |
| Grafite | `#141617` | superfícies elevadas |
| Chumbo | `#2A2D30` | bordas e divisores |
| Cinza Sinal | `#8A9199` | texto secundário (só sobre preto) |
| Névoa | `#F2F4F5` | fundo claro |
| Verde Escuro | `#0B6B4F` | o verde como texto em fundo claro |
| Verde Tinta | `#0F3D30` | fundo de destaque no modo escuro |

Funcionais: atenção `#FFC53D`, atraso `#FF4D4F`, informação `#3B9CFF`.

## Fontes

- Títulos: **Space Grotesk** 500/700
- Texto e interface: **Inter** 400/500/600
- Horários, placas, KPIs e rótulos: **Space Grotesk** 500/700 em caixa alta, com algarismos tabulares
- Só no logo: Chakra Petch 700 (nunca em texto)

Todas no Google Fonts:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap">
```

## Como regenerar os arquivos

Os vetores foram gerados por script (geometria do símbolo + wordmark convertido em curvas). Para alterar a geometria ou exportar novos tamanhos, edite `brand/build/build_brand.py` e rode:

```bash
python3 brand/build/build_brand.py
node brand/build/render_batch.cjs
```

Dependências: Python 3 com `fonttools` e `uharfbuzz`; Node com `playwright` (Chromium).
