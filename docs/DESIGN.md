# Na Hora Frota · Design System

Guia de interface do painel e do app do motorista. Tudo o que está aqui existe
no código: tokens em `src/index.css`, escalas em `tailwind.config.ts`,
componentes em `src/components/ui`, padrões de tela em `src/components/patterns`
e o mapa de telas em `src/config/navigation.ts`.

## 1. Princípios

1. **Qualquer pessoa consegue usar.** Rótulos em português simples, um botão
   principal por tela, o próximo passo sempre visível (até em listas vazias).
2. **Uma coisa de cada vez.** Telas com título, uma frase do que fazem, ações
   à direita e o conteúdo em blocos com título. Nada de 10 botões na mesma linha.
3. **Cor tem significado.** Verde = no prazo/ok, amarelo = atenção, vermelho =
   atraso/ocorrência/erro, azul = em rota/informação, cinza = inativo. Nunca só
   a cor: sempre ponto + texto (`StatusBadge`).
4. **Acessível por padrão.** Contraste AA nos dois temas, tudo funciona pelo
   teclado, foco sempre visível, alvos de toque de 40px ou mais, respeito a
   "reduzir movimento".
5. **Movimento com propósito.** Animação curta (120–360ms) que explica o que
   mudou: a tela entra, o cartão levanta ao passar o mouse, o número corre até
   o valor. Nada pisca nem fica em loop, exceto "ao vivo".

## 2. Temas e tokens

- **Escuro** é o padrão do produto (manual da marca). **Claro** e
  **Automático** (segue o aparelho) ficam no topo (ícone sol/lua), no menu da
  conta, na busca (Ctrl K) e em Configurações > Aparência.
- A troca de tema revela a nova cor em círculo a partir do clique (View
  Transitions); com movimento reduzido, troca direto.
- Use **sempre tokens**, nunca cores fixas:

| Token | Uso |
| --- | --- |
| `background` / `foreground` | fundo da página / texto principal |
| `card`, `popover` | cartões / menus, janelas, folhas |
| `muted` / `muted-foreground` | fundos discretos / texto secundário |
| `accent` | hover de itens e botões fantasma |
| `primary` | ação principal, links, destaque da marca (verde escuro no claro) |
| `brand` | verde vivo decorativo (indicador do menu, seleção) — nunca texto |
| `success`, `warning`, `destructive`, `info`, `idle` | status |
| `chart-1` … `chart-5` | séries de gráficos |
| `border`, `input`, `ring` | bordas, campos, foco |

- Proibido no código de tela: `text-white`, `bg-black`, `bg-white`, hex
  (`#04E8A4`), paletas do Tailwind (`text-green-500`, `bg-amber-100`…). Exceção:
  mapas e PDFs, que usam `STATUS_HEX` (`src/lib/brandSymbol.ts`).
- **Raio:** um token (`--radius` = 12px). `rounded-lg` cartões, `rounded-md`
  campos e botões, `rounded-full` chips, avatares e pontos.
- **Sombras:** `shadow-xs` (campos), `shadow-sm` (cartões), `shadow-md`
  (hover), `shadow-lg`/`shadow-xl` (menus e janelas). No escuro, as sombras
  vêm com um brilho de 1px no topo.
- **Tipografia:** Inter no texto; Space Grotesk em títulos (`h1`–`h6`,
  `font-heading`) e números (`font-data`, algarismos tabulares).
  Tamanhos: h1 28px, h2 18px, corpo 14–15px, legenda 12px. Nada abaixo de 11px.

## 3. Acessibilidade (preferências do usuário)

Configurações > Aparência, salvas no aparelho (`src/lib/preferences.ts`):

- **Tamanho do texto:** normal, grande (+6%), maior (+16%). Tudo é medido em
  `rem`, então a tela inteira acompanha.
- **Reduzir animações:** desliga transições e animações (também segue o
  sistema operacional).
- **Alto contraste:** textos secundários e bordas mais fortes.

Checklist de toda tela:

- [ ] Um `h1` (via `PageHeader`) e `h2` por bloco (`Section`, `CardTitle`).
- [ ] Botão só com ícone tem `aria-label` (e `Tooltip` no computador).
- [ ] Campo tem `Label` ligado por `htmlFor`/`id`; erro com `aria-invalid` e
      mensagem visível abaixo do campo.
- [ ] Cartão clicável é `button` ou `Link` (nunca `div onClick`).
- [ ] Status com texto, não só cor.
- [ ] Imagens com `alt`; ícones decorativos com `aria-hidden`.
- [ ] Funciona com Tab/Enter/Esc; nada fica preso.
- [ ] Sem rolagem lateral no celular (390px); tabelas largas viram cartões.
- [ ] Gráfico com resumo em texto para leitor de tela.
- [ ] Ao fechar janela ou folha, o foco volta ao botão que abriu.

Auditoria automática: axe-core (WCAG 2.2 A/AA + boas práticas) em todas as
telas, nos dois temas, em 1440px e 390px. Meta: zero violações.

## 4. Estrutura (shell)

`src/components/layout/AppShell.tsx` é a rota-pai de todas as telas do
painel. Ela não recarrega ao trocar de tela.

- **Menu lateral** (tablet/computador): telas agrupadas (Operação, Frota,
  Financeiro, Gestão), recolhível (`[`), dica com o nome quando recolhido.
- **Topo:** caminho "Grupo › Tela", busca universal, ao vivo/sem internet,
  tema, ajuda da tela, alertas, conta (no celular).
- **Celular:** barra inferior com Início, Entregas, Motoristas, Acerto e
  **Mais** (todas as telas em grade, tema, ajuda, sair).
- **Busca universal (Ctrl K, ⌘ K ou /):** telas, ações rápidas ("Cadastrar
  motorista"), aparência e dados (motoristas, placas, notas, romaneios).
- **Ajuda (?):** passo a passo da tela atual (vem de `tips` em
  `navigation.ts`) e contato do suporte.
- **Atalhos:** `?` lista; `g` + letra navega (`g e` Entregas, `g m`
  Motoristas…).
- Acessibilidade do shell: link "Pular para o conteúdo", foco vai para o
  conteúdo a cada tela, anúncio para leitor de tela, título da aba por tela.

### Criar uma tela nova

1. Componente em `src/pages/NomeDaTela.tsx` (sem layout próprio: o shell já
   envolve).
2. Rota dentro do `<Route element={<AppShell />}>` em `src/App.tsx`.
3. Item em `NAV_ITEMS` (`src/config/navigation.ts`): rótulo, descrição de uma
   frase, ícone, grupo, palavras de busca, dicas.

## 5. Anatomia de uma tela

```tsx
import { PageHeader, Section, StatCard, EmptyState, FilterBar, SearchInput } from "@/components/patterns";

<PageHeader
  icon={Package}
  title="Entregas"
  description="Notas fiscais, romaneios e o andamento de cada entrega."
  actions={
    <>
      <Button variant="outline"><FileUp /> Importar notas</Button>
      <Button><Route /> Gerar romaneio</Button>
    </>
  }
/>

<div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
  <StatCard label="Pendentes" value={3} icon={Clock} tone="neutral" onClick={...} />
  …
</div>

<Section title="Notas fiscais" actions={…}>
  <FilterBar actions={<Button variant="outline">…</Button>}>
    <SearchInput label="Buscar nota" placeholder="Número, cliente ou endereço" … />
  </FilterBar>
  {items.length === 0 ? (
    <EmptyState icon={FileUp} title="Nenhuma nota ainda" description="Importe os XML para começar." action={<Button>Importar notas</Button>} />
  ) : (
    <Card>…tabela no computador, cartões no celular…</Card>
  )}
</Section>
```

Espaçamento: `space-y-6 md:space-y-8` entre blocos; `gap-4` em grades de
cartões. Grades: KPIs `sm:grid-cols-2 xl:grid-cols-4`; conteúdo principal +
lateral `lg:grid-cols-3` (2 + 1).

## 6. Componentes e padrões

| Precisa de… | Use |
| --- | --- |
| Título da tela | `PageHeader` |
| Bloco com título | `Section` ou `Card` + `CardHeader`/`CardTitle` |
| Indicador (KPI) | `StatCard` (número corre até o valor; clicável abre detalhe) |
| Status | `StatusBadge tone="success"…` |
| Etiqueta neutra | `Badge` (`variant`: default, secondary, success, warning, info, destructive, outline) |
| Lista vazia | `EmptyState` com o próximo passo |
| Carregando | `PageLoading`, `CardsSkeleton`, `ListSkeleton`, `Skeleton` |
| Busca e filtros | `FilterBar` + `SearchInput` + `Select` |
| Confirmar exclusão | `ConfirmDialog tone="danger"` |
| Formulário curto | `Dialog` (vira folha inferior no celular) |
| Detalhe de um item | `Sheet` (lateral) |
| Aviso na tela | `Alert variant="warning" | "info" | "destructive" | "success"` |
| Mensagem rápida | `toast({ title, description })` (`variant: "destructive"` para erro, `"success"` para sucesso) |
| Ação vinda da busca | `useQueryAction("new", () => setOpen(true))` |
| Campo de formulário | `FormField` (rótulo, dica, erro e `aria-*` ligados por render prop) e `FieldGroup` |
| Poucas opções curtas (período, tipo) | `SegmentedControl` (setas do teclado, contagem e ícone opcionais) |
| Indicador que filtra a lista | `FilterStatCard` (`aria-pressed`, selo de marcado) |
| Menu "…" de uma linha | `ActionMenu` (botão com nome: "Ações de João") |
| Foco volta a quem abriu a janela | `useReturnFocus` (`src/hooks`) |

Botões: `default` (principal, 1 por área), `outline` (secundário), `ghost`
(ícones, terciário), `soft` (destaque leve), `destructive` (excluir),
`link`. Tamanhos: `sm` 36px, `default` 40px, `lg` 48px, `icon`, `icon-sm`.
Texto do botão = verbo + objeto ("Importar notas", "Salvar motorista").
Enquanto salva: `<Button loading>` (giro + `aria-busy`, ignora cliques e
continua focável), em vez de `disabled`, que joga o foco para fora.

## 7. Movimento

| Classe | Efeito |
| --- | --- |
| `page-enter` | tela entra subindo 8px (o shell já aplica) |
| `stagger` | filhos entram em sequência (grades de cartões) |
| `card-interactive` | cartão levanta e ganha borda verde no hover |
| `animate-fade-in`, `animate-scale-in`, `animate-pop-in` | entradas pontuais |
| `skeleton-shimmer` | brilho do carregamento |
| `nhf-live` | selo "ao vivo" com ponto pulsando |

Curvas: `ease-out` (expo, padrão), `ease-spring` (confirmações). Durações:
`duration-fast` 120ms, `duration` 200ms, `duration-slow` 360ms.

## 8. Voz

- Frases curtas, sem jargão técnico: "Nota sem romaneio", não "NF não
  roteirizada".
- Botões com verbo: "Cadastrar motorista", "Marcar como pago".
- Sem ponto de exclamação e sem emoji na interface.
- Erros dizem o que aconteceu e o que fazer: "Não foi possível salvar. Confira
  a placa e tente de novo."
- Números em pt-BR: vírgula decimal, `R$ 1.234,56`, datas `dd/mm/aaaa`.
