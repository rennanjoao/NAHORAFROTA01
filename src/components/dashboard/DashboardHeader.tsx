import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { BrandRoutes } from "@/site/components/BrandRoutes";
import { useOnline } from "@/components/layout/useOnline";
import { BRAZIL_TIMEZONE, formatBrazilDateTime } from "@/lib/timezone";
import { firstName } from "@/lib/user";
import { cn } from "@/lib/utils";

function greetingFor(hour: number) {
  if (hour < 5) return "Boa noite";
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Abertura do painel: saudacao, data de hoje e o selo "ao vivo" com a hora
 * (marcador de hora do manual da marca).
 */
export function DashboardHeader({ actions }: { actions?: ReactNode }) {
  const { profile } = useAuth();
  const online = useOnline();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const iso = now.toISOString();
  const name = firstName(profile?.name);
  const greeting = greetingFor(Number(formatBrazilDateTime(iso, "H")));
  const date = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: BRAZIL_TIMEZONE });

  return (
    // Abertura do Inicio: cartao com o brilho verde e o padrao "rotas" da marca.
    <header className="panel-hero relative isolate mb-6 overflow-hidden rounded-2xl border p-5 shadow-sm sm:p-7 md:mb-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-2/3 [mask-image:linear-gradient(to_left,#000,transparent)]">
        <BrandRoutes scale={0.55} />
      </div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {/* Sem internet o selo nao pode dizer "ao vivo": os numeros param na ultima carga. */}
          <p className={cn("nhf-live mb-3 w-fit", !online && "nhf-live--off")}>
            {online ? "Ao vivo" : "Sem internet"} · {formatBrazilDateTime(iso, "HH:mm")}
          </p>
          <h1 className="font-heading text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground md:text-[2.25rem]">
            {name ? `${greeting}, ${name}` : greeting}
          </h1>
          <p className="mt-1.5 max-w-[60ch] text-sm text-muted-foreground md:text-[0.9375rem]">
            {`${date.charAt(0).toUpperCase()}${date.slice(1)}. Veja quem está na rua, o que já foi entregue e o que precisa de atenção.`}
          </p>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 [&>*]:max-sm:flex-1">{actions}</div>}
      </div>
    </header>
  );
}
