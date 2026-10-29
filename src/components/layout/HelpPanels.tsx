import { Keyboard, Lightbulb, Mail, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NAV_ITEMS, SUPPORT_EMAIL } from "@/config/navigation";
import { useNavigation } from "@/hooks/useNavigation";
import { isMac } from "@/lib/platform";
import { useShell } from "./ShellContext";

/** "Ajuda desta tela": o que da para fazer aqui, passo a passo, e contato. */
export function HelpSheet() {
  const { panel, closePanel, openPanel } = useShell();
  const { current } = useNavigation();
  const Icon = current?.icon ?? Lightbulb;

  return (
    <Sheet open={panel === "help"} onOpenChange={(open) => !open && closePanel()}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <SheetTitle>Ajuda · {current?.label ?? "Na Hora Frota"}</SheetTitle>
          <SheetDescription>{current?.description ?? "Como usar o sistema."}</SheetDescription>
        </SheetHeader>

        {current && current.tips.length > 0 && (
          <section aria-labelledby="ajuda-passos">
            <h3 id="ajuda-passos" className="mb-3 text-sm font-semibold">
              Passo a passo
            </h3>
            <ol className="space-y-3">
              {current.tips.map((tip, index) => (
                <li key={tip} className="flex gap-3 text-sm">
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-data text-xs font-semibold text-foreground"
                  >
                    {index + 1}
                  </span>
                  <span className="pt-0.5 leading-relaxed text-muted-foreground">{tip}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section aria-labelledby="ajuda-busca" className="rounded-lg border bg-muted/40 p-4">
          <h3 id="ajuda-busca" className="flex items-center gap-2 text-sm font-semibold">
            <Search className="h-4 w-4 text-primary" aria-hidden="true" />
            Não achou alguma coisa?
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Use a busca no topo da tela. Ela encontra telas, motoristas, placas, notas e romaneios.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => openPanel("palette")}>
            Abrir a busca
          </Button>
        </section>

        <section aria-labelledby="ajuda-suporte" className="mt-auto">
          <h3 id="ajuda-suporte" className="text-sm font-semibold">
            Ainda com dúvida?
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">Nossa equipe responde por e-mail em horário comercial.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Ajuda: ${current?.label ?? "Na Hora Frota"}`)}`}>
                <Mail />
                Falar com o suporte
              </a>
            </Button>
            <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={() => openPanel("shortcuts")}>
              <Keyboard />
              Atalhos do teclado
            </Button>
          </div>
        </section>
      </SheetContent>
    </Sheet>
  );
}

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((key, index) => (
        <kbd key={`${key}-${index}`} className="kbd">
          {key}
        </kbd>
      ))}
    </span>
  );
}

/** Lista de atalhos ("?"). */
export function ShortcutsDialog() {
  const { panel, closePanel } = useShell();
  const mod = isMac() ? "⌘" : "Ctrl";

  const general: { label: string; keys: string[] }[] = [
    { label: "Abrir a busca", keys: [mod, "K"] },
    { label: "Abrir a busca (alternativo)", keys: ["/"] },
    { label: "Ver esta lista", keys: ["?"] },
    { label: "Recolher ou abrir o menu lateral", keys: ["["] },
    { label: "Fechar janela", keys: ["Esc"] },
  ];

  return (
    <Dialog open={panel === "shortcuts"} onOpenChange={(open) => !open && closePanel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Atalhos do teclado</DialogTitle>
          <DialogDescription>Faça tudo sem tirar as mãos do teclado.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          <section aria-labelledby="atalhos-gerais">
            <h3 id="atalhos-gerais" className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Geral
            </h3>
            <ul className="space-y-2">
              {general.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
                  <span>{item.label}</span>
                  <Keys keys={item.keys} />
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="atalhos-telas">
            <h3 id="atalhos-telas" className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Ir para (aperte G e depois a letra)
            </h3>
            <ul className="space-y-2">
              {NAV_ITEMS.filter((item) => item.shortcut).map((item) => (
                <li key={item.path} className="flex items-center justify-between gap-3 text-sm">
                  <span>{item.label}</span>
                  <Keys keys={["G", item.shortcut!.toUpperCase()]} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
