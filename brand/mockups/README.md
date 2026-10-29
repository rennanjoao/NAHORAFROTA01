# Kit de mockups — Na Hora Frota

Use esta pasta para gerar mockups fotorrealistas no Higgsfield, Midjourney, Ideogram, Photoshop ou qualquer gerador de imagem.
As artes em `artes/` são PNG com fundo transparente, em 300 dpi, já no tamanho físico de aplicação.

## Como usar no Higgsfield (ou similar)

1. Gere a cena base com o prompt da peça (abaixo), sem logo, em preto e com um ponto de luz verde-menta.
2. Use a função de **referência de imagem / inpaint / "colocar logo"** e envie a arte da pasta `artes/`.
3. Peça para aplicar a arte na área indicada, mantendo cor exata (`#04E8A4` verde, `#080808` preto, branco) e sem distorcer.
4. Confira com o manual: logo com área de proteção, nunca verde sobre branco, uma arte por peça.

Se o gerador não aceitar referência de imagem, gere a cena limpa e aplique a arte no Photoshop/Figma com modo de mesclagem "Multiplicar" (fundo claro) ou "Tela" (fundo escuro).

## Artes e onde aplicar

| Arquivo | Peça | Posição | Tamanho real |
|---|---|---|---|
| `camiseta-peito-simbolo-verde-60mm.png` | Camiseta preta, frente | Peito esquerdo (lado do coração), 8 cm abaixo da costura do ombro | 60 mm de largura |
| `camiseta-peito-simbolo-branco-60mm.png` | Camiseta preta, frente (versão mono) | Mesma posição | 60 mm |
| `camiseta-costas-wordmark-240mm.png` | Camiseta preta, costas | Centralizado, 10 cm abaixo da gola | 240 mm de largura |
| `camiseta-costas-vertical-200mm.png` | Camiseta preta, costas (alternativa) | Centralizado | 200 mm |
| `bone-frente-simbolo-70mm.png` | Boné preto | Painel frontal, centralizado | 70 mm |
| `bau-lateral-logo-fundo-branco-2400mm.png` | Caminhão baú branco | Lateral, terço dianteiro, centralizado na altura | 2,4 m de largura (≈40% da altura do baú) |
| `bau-lateral-logo-fundo-preto-2400mm.png` | Caminhão baú preto | Mesma posição | 2,4 m |
| `van-faixa-logo-linha-1200mm.png` | Van preta | Painel lateral traseiro | 1,2 m |
| `cartao-frente-logo-45mm.png` | Cartão de visita preto, frente | Canto superior esquerdo, margem 8 mm | 45 mm |
| `cracha-rodape-logo-linha-40mm.png` | Crachá branco | Rodapé, alinhado à esquerda | 40 mm |
| `adesivo-simbolo-preto-90mm.png` | Adesivo redondo verde | Centralizado | 90 mm (adesivo de 150 mm) |

## Prompts base (português, para colar no gerador)

Direção geral em toda cena: operação real de transporte no Brasil, madrugada ou noite, luz natural fria, alto contraste, pretos profundos, saturação baixa, um único ponto de luz verde-menta, lente 28–35 mm, ângulo levemente baixo, fotografia editorial, sem texto, sem logos de terceiros.

**Camiseta (frente)**
> Fotografia editorial de um motorista de transportadora vestindo camiseta preta lisa de algodão, visto do peito para cima, de frente, em um pátio de caminhões ao amanhecer, luz fria natural, um reflexo verde-menta vindo de um celular na mão, lente 35 mm, alto contraste, pretos profundos, fundo desfocado com baú de caminhão, espaço limpo no peito esquerdo da camiseta para aplicar um logo pequeno, sem texto, proporção 4:5.

**Camiseta (costas)**
> Fotografia editorial de um homem de costas vestindo camiseta preta lisa, parado diante de um caminhão baú à noite em pátio de carga, iluminação de poste fria, um ponto de luz verde-menta no painel ao fundo, lente 35 mm, alto contraste, área lisa e sem dobras no centro das costas para aplicar uma estampa grande, sem texto, proporção 4:5.

**Camiseta flat (catálogo)**
> Mockup de camiseta preta lisa de algodão, vista frontal e vista traseira lado a lado, fundo cinza-chumbo neutro, iluminação de estúdio suave, dobras naturais mínimas, sem estampa, fotorrealista, proporção 16:9.

**Caminhão baú**
> Fotografia editorial de um caminhão baú branco novo, visto em diagonal de três quartos, em um pátio de transportadora de madrugada, asfalto molhado refletindo luz fria, faróis acesos, um ponto de luz verde-menta vindo da cabine, lente 28 mm, ângulo baixo, alto contraste, lateral do baú lisa e sem marcas para aplicar um logo grande, sem texto, proporção 16:9.

**Van**
> Fotografia editorial de uma van de carga preta fosca estacionada em rua urbana à noite, vista lateral em leve diagonal, luz de poste fria, reflexos sutis, painel lateral liso para aplicar um logo, sem texto, lente 35 mm, proporção 16:9.

**Boné**
> Mockup fotorrealista de boné preto de brim, visto de frente em leve ângulo, fundo cinza-chumbo, iluminação de estúdio, painel frontal liso para aplicar um símbolo bordado, sem texto, proporção 1:1.

**Cartão de visita**
> Mockup de dois cartões de visita 85 × 55 mm sobre superfície de concreto escuro, um preto fosco e um branco, sombra suave de luz lateral fria, vista de cima em leve ângulo, sem texto, proporção 4:5.

**Crachá**
> Mockup de crachá branco vertical 54 × 86 mm com cordão preto, sobre fundo cinza-chumbo, iluminação de estúdio, área livre no rodapé para aplicar um logo, sem texto, proporção 4:5.

**Placa de pátio**
> Fotografia de placa de sinalização preta com moldura cinza em parede de galpão logístico, luz fria de madrugada, vista frontal, superfície lisa para aplicar texto e símbolo, sem texto, proporção 3:1.

## Aplicar a arte com precisão (script)

Depois de gerar a cena limpa, o script `brand/build/compose_mockup.py` encaixa a arte em perspectiva e mescla com a superfície:

```bash
python3 brand/build/compose_mockup.py cena.png brand/mockups/artes/camiseta-peito-simbolo-verde-60mm.png saida.png \
  --quad 820,640 1010,650 1010,760 820,750 --blend screen --opacity 0.95
```

- `--quad`: os 4 cantos (superior-esquerdo, superior-direito, inferior-direito, inferior-esquerdo) em pixels da cena. A arte é deformada para caber ali sem perder a proporção.
- `--blend`: `multiply` em superfícies claras (baú branco, cartão branco), `screen` para arte clara em tecido escuro, `normal` para sobrepor sem mesclar.
- Precisa de Python 3 com `pillow` e `numpy`.

## Checklist antes de aprovar o mockup

- Logo na versão certa para o fundo (branco + verde no preto; preto + verde no branco; nunca verde sobre branco).
- Proporção travada, sem rotação, sem brilho, sombra ou 3D no logo.
- Área de proteção respeitada (altura do símbolo ÷ 4).
- Verde exato `#04E8A4`; se o gerador "esquentar" a cor, corrija no Photoshop.
