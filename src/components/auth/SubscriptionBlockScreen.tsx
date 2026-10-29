import { ShieldAlert, Phone, Mail } from "lucide-react";

export function SubscriptionBlockScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="mx-auto h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Acesso Suspenso</h1>
        <p className="text-muted-foreground">
          Sua assinatura expirou. O acesso às funcionalidades foi temporariamente suspenso.
        </p>
        <p className="text-muted-foreground text-sm">
          Entre em contato com o suporte para renovação do seu plano e restabelecer o acesso ao sistema.
        </p>
        <div className="flex flex-col gap-3 pt-4">
          <a
            href="mailto:suporte@nahorafrota.com.br"
            className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            <Mail className="h-4 w-4" />
            suporte@nahorafrota.com.br
          </a>
        </div>
      </div>
    </div>
  );
}
