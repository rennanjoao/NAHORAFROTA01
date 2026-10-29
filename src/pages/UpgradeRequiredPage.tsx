import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeatureAccess, type Feature } from "@/hooks/useFeatureAccess";

const SUPPORT_EMAIL = "suporte@nahorafrota.com.br";

const FEATURE_INFO: Record<Feature, { title: string; description: string }> = {
  financial_dashboard: {
    title: "O acerto financeiro",
    description: "Calcule quanto pagar a cada motorista, registre os pagamentos e veja a rentabilidade de cada rota.",
  },
  financial_reports: {
    title: "Os relatórios financeiros",
    description: "Custos, fretes e rentabilidade por período, prontos para exportar.",
  },
  reports: {
    title: "Os relatórios",
    description: "SLA, custos, eficiência e ocorrências por período, prontos para exportar em PDF.",
  },
  sla_weekly: { title: "O SLA semanal", description: "Acompanhe a pontualidade da semana e o histórico de cada período." },
  sla_drilldown: { title: "O SLA por motorista", description: "Veja a pontualidade de cada motorista, entrega por entrega." },
  sla_evolution: { title: "A evolução do SLA", description: "Compare a pontualidade das entregas semana a semana." },
  realtime_dashboard: {
    title: "O mapa ao vivo",
    description: "Veja onde cada motorista está agora e o andamento das entregas em tempo real.",
  },
  batch_import: { title: "A importação em lote", description: "Importe dezenas de notas fiscais (XML) de uma só vez." },
};

const STEPS = [
  "Fale com a equipe pelo e-mail ou pelo botão abaixo.",
  "Escolhemos juntos o plano certo para a sua operação.",
  "O acesso é liberado e seus dados continuam como estão.",
];

/** Tela de recurso fora do plano (dentro do painel). Aceita ?feature= e ?plano=. */
export default function UpgradeRequiredPage() {
  const [searchParams] = useSearchParams();
  const { checkFeatureAccess, plan, planLabels } = useFeatureAccess();

  const featureParam = searchParams.get("feature") as Feature | null;
  const info = featureParam && featureParam in FEATURE_INFO ? FEATURE_INFO[featureParam] : null;
  const requiredPlan =
    searchParams.get("plano") || (info && featureParam ? checkFeatureAccess(featureParam).upgradePlanLabel : "") || null;
  const currentPlan = planLabels[plan] || plan;

  const title = info
    ? `${info.title} faz parte do plano ${requiredPlan ?? "superior"}`
    : requiredPlan
      ? `Este recurso faz parte do plano ${requiredPlan}`
      : "Este recurso faz parte de outro plano";

  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `Quero liberar ${requiredPlan ? `o plano ${requiredPlan}` : "um recurso"}`,
  )}`;

  return (
    <div className="flex justify-center py-4 md:py-12">
      <section
        aria-labelledby="upgrade-titulo"
        className="relative w-full max-w-xl overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm animate-scale-in"
      >
        <div aria-hidden="true" className="nhf-routes pointer-events-none absolute inset-x-0 top-0 h-40" />

        <div className="relative space-y-6 p-6 text-center sm:p-10">
          <span
            aria-hidden="true"
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border bg-background text-primary shadow-sm"
          >
            <Lock className="h-6 w-6" />
          </span>

          <div className="space-y-2">
            <p className="nhf-label text-primary">{requiredPlan ? `Plano ${requiredPlan}` : "Recurso de outro plano"}</p>
            <h1 id="upgrade-titulo" className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
              {title}
            </h1>
            <p className="mx-auto max-w-md text-[0.9375rem] text-muted-foreground">
              {info?.description ?? "Seu plano atual não inclui esta tela. A equipe Na Hora Frota libera para você."}
            </p>
            <p className="text-sm text-muted-foreground">
              Seu plano hoje: <span className="font-medium text-foreground">{currentPlan}</span>
            </p>
          </div>

          <ol className="mx-auto max-w-sm space-y-2.5 text-left">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-start gap-3 text-sm text-foreground">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-data text-xs font-semibold text-primary"
                >
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-center">
            <Button asChild variant="outline">
              <Link to="/">
                <ArrowLeft aria-hidden="true" />
                Voltar para o início
              </Link>
            </Button>
            <Button asChild>
              <a href={mailto}>
                <Mail aria-hidden="true" />
                Falar com a equipe
              </a>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Ou escreva para{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary underline-offset-4 hover:underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
