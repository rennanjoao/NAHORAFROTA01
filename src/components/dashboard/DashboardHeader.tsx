import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/patterns";
import { BRAZIL_TIMEZONE, formatBrazilDateTime } from "@/lib/timezone";
import { firstName } from "@/lib/user";

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
    <>
      <p className="nhf-live mb-3 w-fit">Ao vivo · {formatBrazilDateTime(iso, "HH:mm")}</p>
      <PageHeader
        title={name ? `${greeting}, ${name}` : greeting}
        description={`${date.charAt(0).toUpperCase()}${date.slice(1)}. Veja quem está na rua, o que já foi entregue e o que precisa de atenção.`}
        actions={actions}
      />
    </>
  );
}
