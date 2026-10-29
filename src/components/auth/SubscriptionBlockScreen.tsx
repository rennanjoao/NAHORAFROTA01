import { Ban, Clock, CreditCard, Hourglass, LogOut, Mail, type LucideIcon } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export type BlockReason = "expired" | "trial_expired" | "blocked" | "pending";

const SUPPORT_EMAIL = "suporte@nahorafrota.com.br";

const COPY: Record<
  BlockReason,
  { title: string; message: string; nextStep: string; badge: string; icon: LucideIcon; tone: "warning" | "danger" | "info"; subject: string }
> = {
  expired: {
    title: "Acesso suspenso",
    message: "A assinatura da sua empresa venceu e o acesso ao sistema foi pausado.",
    nextStep: "Fale com a equipe para renovar o plano. Assim que o pagamento for confirmado, o acesso volta e seus dados continuam guardados.",
    badge: "Assinatura vencida",
    icon: CreditCard,
    tone: "warning",
    subject: "Renovar assinatura",
  },
  trial_expired: {
    title: "Seu teste grátis terminou",
    // Sem "7 dias": o teste pode ter sido estendido.
    message: "O período de teste grátis do Na Hora Frota chegou ao fim e o acesso foi pausado.",
    nextStep: "Fale com a nossa equipe para contratar um plano e continuar de onde parou. Seus dados ficam guardados.",
    badge: "Teste encerrado",
    icon: Hourglass,
    tone: "warning",
    subject: "Contratar plano após o teste",
  },
  blocked: {
    title: "Conta bloqueada",
    message: "O acesso da sua empresa ao Na Hora Frota foi suspenso.",
    nextStep: "Fale com a equipe para entender o motivo e reativar o acesso.",
    badge: "Acesso suspenso",
    icon: Ban,
    tone: "danger",
    subject: "Conta bloqueada",
  },
  pending: {
    title: "Cadastro em análise",
    message: "Sua empresa está aguardando a liberação da equipe Na Hora Frota.",
    nextStep: "Assim que o acesso for liberado, você entra normalmente. Se tiver pressa, fale com a gente.",
    badge: "Aguardando liberação",
    icon: Clock,
    tone: "info",
    subject: "Liberação de cadastro",
  },
};

const TONE_CLASSES = {
  warning: { chip: "bg-warning/10 text-warning", dot: "bg-warning" },
  danger: { chip: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  info: { chip: "bg-info/10 text-info", dot: "bg-info" },
} as const;

interface SubscriptionBlockScreenProps {
  reason?: BlockReason;
  /** Texto voltado ao motorista, que nao gerencia a assinatura. */
  forDriver?: boolean;
}

/** Tela inteira quando a empresa perde o acesso (fora do painel). */
export function SubscriptionBlockScreen({ reason = "expired", forDriver = false }: SubscriptionBlockScreenProps) {
  const { signOut } = useAuth();
  const copy = COPY[reason] ?? COPY.expired;
  const Icon = copy.icon;
  const tone = TONE_CLASSES[copy.tone];

  const title = forDriver ? "App indisponível" : copy.title;
  const message = forDriver
    ? "O acesso da sua transportadora ao Na Hora Frota está suspenso no momento."
    : copy.message;
  const nextStep = forDriver ? "Fale com o responsável pela frota da sua empresa." : copy.nextStep;

  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div aria-hidden="true" className="nhf-routes pointer-events-none absolute inset-0" />

      <header className="relative z-10 mx-auto w-full max-w-md">
        <BrandLogo arrangement="horizontal" className="w-[160px]" />
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center py-10">
        <section
          aria-labelledby="bloqueio-titulo"
          className="w-full max-w-md rounded-2xl border bg-card p-6 text-card-foreground shadow-lg animate-scale-in sm:p-8"
        >
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className={cn("flex h-12 w-12 items-center justify-center rounded-xl", tone.chip)}>
              <Icon className="h-6 w-6" />
            </span>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", tone.chip)}>
              <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
              {forDriver ? "Acesso suspenso" : copy.badge}
            </span>
          </div>

          <h1 id="bloqueio-titulo" className="mt-5 text-2xl font-semibold leading-tight tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">{message}</p>

          <div className="mt-6 rounded-lg border bg-muted/40 p-4">
            <p className="nhf-label text-muted-foreground">O que fazer agora</p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground">{nextStep}</p>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            {!forDriver && (
              <Button asChild size="lg">
                <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(copy.subject)}`}>
                  <Mail aria-hidden="true" />
                  Falar com a equipe
                </a>
              </Button>
            )}
            <Button variant={forDriver ? "default" : "ghost"} size="lg" onClick={() => signOut()}>
              <LogOut aria-hidden="true" />
              Sair
            </Button>
          </div>

          {!forDriver && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Ou escreva para{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary underline-offset-4 hover:underline">
                {SUPPORT_EMAIL}
              </a>
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
