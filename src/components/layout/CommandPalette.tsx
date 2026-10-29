import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Accessibility,
  ArrowRight,
  CircleHelp,
  FileUp,
  Keyboard,
  Loader2,
  LogOut,
  Mail,
  Monitor,
  Moon,
  RefreshCw,
  Search,
  Sun,
  Truck,
  Type,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { usePreferences } from "@/components/theme/PreferencesProvider";
import { SUPPORT_EMAIL } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigation } from "@/hooks/useNavigation";
import { KIND_META, searchAll, toFilterTerm, type ResultKind, type SearchResult } from "@/lib/globalSearch";
import { useShell } from "./ShellContext";
import { useOnline } from "./useOnline";

interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  keywords: string[];
  /** So aparece se a pessoa pode abrir esta tela. */
  requires?: string;
  /** Leva para esta tela (o foco vai para o conteudo dela). */
  to?: string;
  /** Troca a busca por outro painel (ajuda, atalhos). */
  panel?: "help" | "shortcuts";
  run?: () => void;
}

/** Sem acento e minusculo: "veículo" acha "veiculo". */
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Todas as palavras digitadas precisam aparecer no texto (em qualquer ordem). */
function matches(query: string, ...fields: (string | undefined)[]) {
  const haystack = normalize(fields.filter(Boolean).join(" "));
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

function Item({
  value,
  icon: Icon,
  label,
  hint,
  shortcut,
  onSelect,
}: {
  value: string;
  icon: LucideIcon;
  label: string;
  hint?: string;
  shortcut?: string;
  onSelect: () => void;
}) {
  return (
    <CommandPrimitive.Item
      value={value}
      onSelect={onSelect}
      className="group relative flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors duration-fast data-[selected=true]:bg-accent"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground group-data-[selected=true]:border-primary/30 group-data-[selected=true]:text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{label}</span>
        {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
      </span>
      {shortcut && (
        <span className="hidden items-center gap-1 md:flex" aria-hidden="true">
          <span className="kbd">G</span>
          <span className="kbd">{shortcut.toUpperCase()}</span>
        </span>
      )}
      <ArrowRight
        className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-data-[selected=true]:opacity-100"
        aria-hidden="true"
      />
    </CommandPrimitive.Item>
  );
}

const groupClass =
  "px-1 py-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground";

/** Busca universal: telas, acoes rapidas, preferencias e dados (Ctrl K ou "/"). */
export function CommandPalette() {
  const { panel, closePanel, openPanel, restoreFocus } = useShell();
  const open = panel === "palette";
  const navigate = useNavigate();
  const { items } = useNavigation();
  const { setTheme, setPreference, textSize } = usePreferences();
  const { signOut } = useAuth();

  const online = useOnline();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const requestRef = useRef(0);
  const term = toFilterTerm(query);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    // Sem internet nao busca dados (telas e acoes continuam funcionando).
    if (term.length < 2 || !online) {
      setResults([]);
      setSearching(false);
      return;
    }
    const request = ++requestRef.current;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const found = await searchAll(term);
        if (request === requestRef.current) setResults(found);
      } catch (error) {
        console.error("Global search error:", error);
        if (request === requestRef.current) setResults([]);
      } finally {
        if (request === requestRef.current) setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [term, online]);

  const run = (fn: () => void) => {
    closePanel();
    // Deixa a janela fechar antes de agir (tema, recarregar, sair).
    window.setTimeout(fn, 0);
  };

  // Ir para uma tela: o foco vai para o conteudo da tela nova.
  const go = (path: string) => {
    closePanel({ focusMain: true });
    window.setTimeout(() => navigate(path), 0);
  };

  const nextTextSize = textSize === "normal" ? "large" : textSize === "large" ? "larger" : "normal";

  const actions: PaletteAction[] = useMemo(
    () => [
      {
        id: "import",
        label: "Importar notas fiscais (XML)",
        hint: "Entregas",
        icon: FileUp,
        keywords: ["xml", "nota", "nf", "importar", "carregar"],
        requires: "/deliveries",
        to: "/deliveries?action=import",
      },
      {
        id: "new-driver",
        label: "Cadastrar motorista",
        hint: "Motoristas",
        icon: UserPlus,
        keywords: ["novo", "motorista", "entregador", "adicionar"],
        requires: "/drivers",
        to: "/drivers?action=new",
      },
      {
        id: "new-vehicle",
        label: "Cadastrar veículo",
        hint: "Veículos",
        icon: Truck,
        keywords: ["novo", "veiculo", "placa", "adicionar", "caminhao"],
        requires: "/vehicles",
        to: "/vehicles?action=new",
      },
      {
        id: "help",
        label: "Ajuda desta tela",
        hint: "Passo a passo do que fazer aqui",
        icon: CircleHelp,
        keywords: ["ajuda", "como", "duvida", "tutorial"],
        panel: "help",
      },
      {
        id: "shortcuts",
        label: "Atalhos do teclado",
        icon: Keyboard,
        keywords: ["atalho", "teclado", "tecla"],
        panel: "shortcuts",
      },
      {
        id: "support",
        label: "Falar com o suporte",
        hint: SUPPORT_EMAIL,
        icon: Mail,
        keywords: ["suporte", "contato", "ajuda", "email", "problema"],
        run: () => {
          window.location.href = `mailto:${SUPPORT_EMAIL}`;
        },
      },
      {
        id: "reload",
        label: "Recarregar dados",
        icon: RefreshCw,
        keywords: ["atualizar", "recarregar", "refresh"],
        run: () => window.location.reload(),
      },
      {
        id: "logout",
        label: "Sair da conta",
        icon: LogOut,
        keywords: ["sair", "logout", "deslogar", "trocar usuario"],
        run: async () => {
          await signOut();
          navigate("/login");
        },
      },
    ],
    [navigate, signOut],
  );

  const appearance: PaletteAction[] = [
    { id: "theme-light", label: "Usar tema claro", icon: Sun, keywords: ["tema", "claro", "branco", "dia"], run: () => setTheme("light") },
    { id: "theme-dark", label: "Usar tema escuro", icon: Moon, keywords: ["tema", "escuro", "preto", "noite", "dark"], run: () => setTheme("dark") },
    {
      id: "theme-system",
      label: "Tema automático",
      hint: "Igual ao do seu aparelho",
      icon: Monitor,
      keywords: ["tema", "automatico", "sistema"],
      run: () => setTheme("system"),
    },
    {
      id: "text-size",
      label: nextTextSize === "normal" ? "Voltar o texto ao tamanho normal" : "Aumentar o tamanho do texto",
      icon: Type,
      keywords: ["texto", "fonte", "letra", "maior", "zoom", "tamanho", "acessibilidade"],
      run: () => setPreference("textSize", nextTextSize),
    },
    {
      id: "a11y",
      label: "Aparência e acessibilidade",
      hint: "Contraste, animações e tamanho do texto",
      icon: Accessibility,
      keywords: ["acessibilidade", "contraste", "animacao", "aparencia", "configuracao"],
      to: "/settings?tab=appearance",
    },
  ];

  const allowedPaths = new Set(items.map((item) => item.path));
  const visibleActions = actions.filter((action) => !action.requires || allowedPaths.has(action.requires));
  const q = query.trim();
  const screens = q ? items.filter((item) => matches(q, item.label, item.description, item.keywords?.join(" "))) : items;
  const quick = q ? visibleActions.filter((a) => matches(q, a.label, a.hint, a.keywords.join(" "))) : visibleActions.slice(0, 3);
  const prefs = q ? appearance.filter((a) => matches(q, a.label, a.hint, a.keywords.join(" "))) : appearance.slice(0, 2);

  const grouped = (Object.keys(KIND_META) as ResultKind[])
    .map((kind) => ({ kind, items: results.filter((r) => r.kind === kind) }))
    .filter((group) => group.items.length > 0);

  const select = (action: PaletteAction) => {
    if (action.to) go(action.to);
    else if (action.panel) openPanel(action.panel);
    else if (action.run) run(action.run);
  };

  const nothing = q && !searching && screens.length + quick.length + prefs.length + results.length === 0;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && closePanel()}>
      <DialogContent hideClose position="top" onCloseAutoFocus={restoreFocus} className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Buscar ou ir para</DialogTitle>
        <DialogDescription className="sr-only">
          Digite o nome de uma tela, de um motorista, uma placa ou o número de uma nota fiscal.
        </DialogDescription>
        <CommandPrimitive shouldFilter={false} loop className="flex flex-col">
          <div className="flex items-center gap-3 border-b px-4">
            {searching ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
            ) : (
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <CommandPrimitive.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Tela, motorista, placa ou número da nota…"
              className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
              aria-label="Buscar"
            />
            <kbd className="kbd hidden sm:inline-flex">Esc</kbd>
          </div>

          <CommandPrimitive.List className="max-h-[min(62vh,440px)] overflow-y-auto overscroll-contain p-1.5">
            {q.length >= 2 && !online && (
              <div role="status" className="mx-1.5 my-1.5 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">Sem internet</p>
                <p className="mt-0.5 text-muted-foreground">Motoristas, placas e notas voltam a aparecer quando a conexão voltar. Telas e atalhos funcionam.</p>
              </div>
            )}

            {nothing && online && (
              <div className="px-6 py-10 text-center">
                <p className="text-sm font-medium text-foreground">Nada encontrado para “{q}”.</p>
                <p className="mt-1 text-sm text-muted-foreground">Tente o número da nota, a placa ou parte do nome.</p>
              </div>
            )}

            {screens.length > 0 && (
              <CommandPrimitive.Group heading={q ? "Telas" : "Ir para"} className={groupClass}>
                {screens.map((item) => (
                  <Item
                    key={item.path}
                    value={`tela-${item.path}`}
                    icon={item.icon}
                    label={item.label}
                    hint={item.description}
                    shortcut={item.shortcut}
                    onSelect={() => go(item.path)}
                  />
                ))}
              </CommandPrimitive.Group>
            )}

            {grouped.map(({ kind, items: found }) => (
              <CommandPrimitive.Group key={kind} heading={KIND_META[kind].label} className={groupClass}>
                {found.map((result) => (
                  <Item
                    key={`${result.kind}-${result.id}`}
                    value={`${result.kind}-${result.id}`}
                    icon={KIND_META[kind].icon}
                    label={result.title}
                    hint={result.subtitle}
                    onSelect={() => go(result.href)}
                  />
                ))}
              </CommandPrimitive.Group>
            ))}

            {quick.length > 0 && (
              <CommandPrimitive.Group heading="Ações rápidas" className={groupClass}>
                {quick.map((action) => (
                  <Item
                    key={action.id}
                    value={`acao-${action.id}`}
                    icon={action.icon}
                    label={action.label}
                    hint={action.hint}
                    onSelect={() => select(action)}
                  />
                ))}
              </CommandPrimitive.Group>
            )}

            {prefs.length > 0 && (
              <CommandPrimitive.Group heading="Aparência" className={groupClass}>
                {prefs.map((action) => (
                  <Item
                    key={action.id}
                    value={`pref-${action.id}`}
                    icon={action.icon}
                    label={action.label}
                    hint={action.hint}
                    onSelect={() => select(action)}
                  />
                ))}
              </CommandPrimitive.Group>
            )}
          </CommandPrimitive.List>

          <div className="hidden items-center gap-4 border-t px-4 py-2.5 text-xs text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5">
              <span className="kbd">↑</span>
              <span className="kbd">↓</span>
              navegar
            </span>
            <span className="flex items-center gap-1.5">
              <span className="kbd">Enter</span>
              abrir
            </span>
            {/* "?" digitaria no campo: aqui vira um botao. */}
            <button
              type="button"
              onClick={() => openPanel("shortcuts")}
              className="-my-1 ml-auto rounded-md px-1.5 py-1 font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Todos os atalhos
            </button>
          </div>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}
