import { useRef, useState, type KeyboardEvent } from "react";
import { Loader2, LogOut, Mail } from "lucide-react";
import { ThemeSegmented } from "@/components/theme/ThemeToggle";
import { usePreferences } from "@/components/theme/PreferencesProvider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { brandAvatar } from "@/lib/avatar";
import type { TextSize } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { initialsOf } from "./initials";
import { ScreenHeader } from "./ScreenHeader";

interface SettingsTabProps {
  driverName: string;
  vehicle?: string;
}

const TEXT_SIZES: { value: TextSize; label: string; sample: string }[] = [
  { value: "normal", label: "Normal", sample: "text-sm" },
  { value: "large", label: "Grande", sample: "text-base" },
  { value: "larger", label: "Maior", sample: "text-lg" },
];

function SettingsGroup({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-lg font-semibold text-foreground">
        {title}
      </h2>
      <div className="divide-y rounded-xl border bg-card shadow-sm">{children}</div>
    </section>
  );
}

/** Linha inteira clicavel (bom com luva) com nome e explicacao ligados ao switch. */
function SwitchRow({
  id,
  title,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string;
  title: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex min-h-16 cursor-pointer items-center gap-4 p-4">
      <span className="min-w-0 flex-1">
        <span id={`${id}-nome`} className="block text-[0.9375rem] font-medium text-foreground">
          {title}
        </span>
        <span id={`${id}-dica`} className="block text-sm text-muted-foreground">
          {hint}
        </span>
      </span>
      <Switch
        id={id}
        aria-labelledby={`${id}-nome`}
        aria-describedby={`${id}-dica`}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </label>
  );
}

export function SettingsTab({ driverName, vehicle }: SettingsTabProps) {
  const { user, profile, signOut } = useAuth();
  const { textSize, contrast, motion, setPreference } = usePreferences();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const sizesRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    setLeaving(true);
    await signOut();
    window.location.href = "/login";
  };

  // Radiogroup: um so ponto de Tab; as setas trocam o tamanho (igual ao seletor de tema).
  const onSizeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = TEXT_SIZES.findIndex((option) => option.value === textSize);
    const next = (Math.max(index, 0) + step + TEXT_SIZES.length) % TEXT_SIZES.length;
    setPreference("textSize", TEXT_SIZES[next].value);
    sizesRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };

  return (
    <>
      <ScreenHeader title="Configurações" description="Seus dados e como o app aparece na tela." />

      <div className="space-y-8">
        <section aria-label="Seu perfil" className="flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm">
          <Avatar className="h-16 w-16 border-2 border-primary/40">
            <AvatarImage src={brandAvatar(profile?.avatar_url)} alt="" />
            <AvatarFallback className="bg-primary/10 text-lg text-primary">{initialsOf(driverName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="break-words font-heading text-lg font-semibold leading-snug text-foreground">{driverName}</p>
            <p className="text-sm text-muted-foreground">Motorista{vehicle ? ` · ${vehicle}` : ""}</p>
            {user?.email && (
              <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{user.email}</span>
              </p>
            )}
          </div>
        </section>

        <SettingsGroup id="aparencia-titulo" title="Aparência">
          <div className="space-y-3 p-4">
            <p className="text-[0.9375rem] font-medium text-foreground" aria-hidden="true">
              Tema
            </p>
            <ThemeSegmented className="[&>button]:min-h-14 [&>button]:flex-col [&>button]:gap-1 [&>button]:text-xs [&_svg]:h-[1.125rem] [&_svg]:w-[1.125rem]" />
            <p className="text-sm text-muted-foreground">No sol, o tema claro costuma ficar mais fácil de ler.</p>
          </div>

          <div className="space-y-3 p-4">
            <p id="tamanho-rotulo" className="text-[0.9375rem] font-medium text-foreground">
              Tamanho do texto
            </p>
            <div
              ref={sizesRef}
              role="radiogroup"
              aria-labelledby="tamanho-rotulo"
              onKeyDown={onSizeKeyDown}
              className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
            >
              {TEXT_SIZES.map((option) => {
                const selected = textSize === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setPreference("textSize", option.value)}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center rounded-md px-2 font-medium transition-all duration ease-out",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span aria-hidden="true" className={cn("font-heading font-semibold leading-none", option.sample)}>
                      Aa
                    </span>
                    <span className="mt-1 text-xs">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <SwitchRow
            id="contraste"
            title="Mais contraste"
            hint="Letras e bordas mais fortes para ler no sol."
            checked={contrast === "more"}
            onCheckedChange={(checked) => setPreference("contrast", checked ? "more" : "normal")}
          />
          <SwitchRow
            id="animacoes"
            title="Reduzir animações"
            hint="A tela troca direto, sem movimento."
            checked={motion === "reduce"}
            onCheckedChange={(checked) => setPreference("motion", checked ? "reduce" : "system")}
          />
        </SettingsGroup>

        <SettingsGroup id="sobre-titulo" title="Sobre o app">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 p-4 text-sm">
            <dt className="text-muted-foreground">Versão</dt>
            <dd className="text-right font-data text-foreground">1.0.0</dd>
            <dt className="text-muted-foreground">Empresa</dt>
            <dd className="text-right text-foreground">© {new Date().getFullYear()} Na Hora Frota</dd>
          </dl>
        </SettingsGroup>

        <Button
          variant="outline"
          size="lg"
          onClick={() => setConfirmLogout(true)}
          className="h-14 w-full border-destructive/40 text-base text-destructive hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut aria-hidden="true" />
          Sair da conta
        </Button>
      </div>

      {/* Mesma confirmacao do ConfirmDialog, com botoes de 48px (toque com luva). */}
      <AlertDialog open={confirmLogout} onOpenChange={(next) => !leaving && setConfirmLogout(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da conta?</AlertDialogTitle>
            <AlertDialogDescription>
              O GPS para de enviar sua localização. Para voltar, entre de novo com seu e-mail e senha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-0")}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              aria-disabled={leaving || undefined}
              onClick={(event) => {
                event.preventDefault();
                if (!leaving) handleLogout();
              }}
              className={buttonVariants({ variant: "destructive", size: "lg" })}
            >
              {leaving && <Loader2 className="animate-spin" aria-hidden="true" />}
              {leaving ? "Saindo" : "Sair da conta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
