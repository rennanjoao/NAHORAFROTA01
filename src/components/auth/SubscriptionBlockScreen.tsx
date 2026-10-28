import { ShieldAlert, Mail, LogOut, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export type BlockReason = "expired" | "trial_expired" | "blocked" | "pending";

const COPY: Record<BlockReason, { title: string; message: string; hint: string }> = {
  expired: {
    title: "Acesso Suspenso",
    message: "Sua assinatura expirou. O acesso às funcionalidades foi temporariamente suspenso.",
    hint: "Entre em contato com o suporte para renovação do seu plano e restabelecer o acesso ao sistema.",
  },
  trial_expired: {
    title: "Seu teste grátis terminou",
    message: "Os 7 dias de teste do NaHora Frota chegaram ao fim e o acesso foi suspenso.",
    hint: "Fale com a nossa equipe para contratar um plano e continuar de onde parou. Seus dados ficam guardados.",
  },
  blocked: {
    title: "Conta Bloqueada",
    message: "O acesso da sua empresa foi suspenso.",
    hint: "Entre em contato com o suporte para entender o motivo e reativar o acesso.",
  },
  pending: {
    title: "Conta em Análise",
    message: "Sua empresa ainda está aguardando liberação da equipe NaHora Frota.",
    hint: "Assim que o acesso for liberado você poderá entrar normalmente.",
  },
};

interface SubscriptionBlockScreenProps {
  reason?: BlockReason;
  /** Texto voltado ao motorista, que nao gerencia a assinatura. */
  forDriver?: boolean;
}

export function SubscriptionBlockScreen({ reason = "expired", forDriver = false }: SubscriptionBlockScreenProps) {
  const { signOut } = useAuth();
  const copy = COPY[reason];
  const Icon = reason === "pending" ? Clock : ShieldAlert;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="mx-auto h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <Icon className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{forDriver ? "App indisponível" : copy.title}</h1>
        <p className="text-muted-foreground">
          {forDriver
            ? "O acesso da sua transportadora ao NaHora Frota está suspenso no momento."
            : copy.message}
        </p>
        <p className="text-muted-foreground text-sm">
          {forDriver ? "Fale com o responsável pela frota." : copy.hint}
        </p>
        <div className="flex flex-col gap-3 pt-4">
          {!forDriver && (
            <a
              href="mailto:suporte@nahorafrota.com.br"
              className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <Mail className="h-4 w-4" />
              suporte@nahorafrota.com.br
            </a>
          )}
          <button
            type="button"
            onClick={() => signOut()}
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
