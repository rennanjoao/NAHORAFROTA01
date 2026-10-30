import { AlertTriangle, CalendarDays, MapPinned, Moon, Package, ShieldAlert, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader, Section, StatCard } from "@/components/patterns";
import { BrasilRiskMap } from "@/components/dashboard/BrasilRiskMap";
import { nationalStats } from "@/components/dashboard/riskZones";
import { cargoTheft, cargoTheftSource } from "@/lib/riskStats";
import { cn } from "@/lib/utils";

/** "Sexta-feira (23,2%)" -> ["Sexta-feira", "23,2%"] */
function splitStat(text: string): [string, string] {
  const match = /^(.*?)\s*\((.*)\)$/.exec(text);
  return match ? [match[1], match[2]] : [text, ""];
}

const pct = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const signed = (value: number | null) => (value === null ? "sem base" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${pct(Math.abs(value))}`);
const UF_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo",
  GO: "Goiás", MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul", MT: "Mato Grosso", PA: "Pará", PB: "Paraíba",
  PE: "Pernambuco", PI: "Piauí", PR: "Paraná", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RO: "Rondônia", RR: "Roraima",
  RS: "Rio Grande do Sul", SC: "Santa Catarina", SE: "Sergipe", SP: "São Paulo", TO: "Tocantins",
};

export default function RoutesPage() {
  const [peakDay, peakDayShare] = splitStat(nationalStats.peakDay);
  const [peakHour, peakHourShare] = splitStat(nationalStats.peakHour);
  const t = cargoTheft;
  const updated = new Date(`${cargoTheftSource.updatedAt}T12:00:00`).toLocaleDateString("pt-BR");
  const topStates = t.states.slice(0, 8);
  const topMax = topStates[0]?.ytd || 1;

  return (
    <>
      <PageHeader
        icon={ShieldAlert}
        title="Áreas de risco"
        description={`Onde mais acontecem roubos de carga no Brasil, com dados oficiais até ${t.latestMonthLabel}. Use para planejar rotas e horários mais seguros.`}
      />

      <div className="space-y-8 md:space-y-10">
        <BrasilRiskMap />

        <Section title="O Brasil em números" description={`Roubos de carga registrados pelas polícias dos estados, de ${t.periodLabel}.`}>
          <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={`Roubos de carga em ${t.year}`}
              value={t.nationalYtd}
              icon={AlertTriangle}
              tone="danger"
              hint={`De ${t.periodLabel} · ${signed(t.nationalChange)} contra ${t.lastYear}`}
            />
            <StatCard
              label={`Roubos em ${t.lastYear}`}
              value={t.lastYearTotal}
              icon={(t.lastYearChange ?? 0) > 0 ? TrendingUp : TrendingDown}
              tone="neutral"
              hint={`Ano inteiro · ${signed(t.lastYearChange)} contra ${t.lastYear - 1}`}
            />
            <StatCard label={`Prejuízo em ${t.lastYear}`} value={nationalStats.loss2025} icon={Wallet} tone="neutral" hint={nationalStats.loss2025Hint} />
            <StatCard label="Prejuízo no Sudeste" value={nationalStats.sudeste} icon={MapPinned} tone="warning" hint={nationalStats.sudesteHint} />
          </div>
        </Section>

        <Section title="Estados com mais casos" description={`De ${t.periodLabel}, com a variação contra o mesmo período de ${t.lastYear}.`}>
          <Card className="p-5 sm:p-6">
            <ol className="space-y-3">
              {topStates.map((state, index) => (
                <li key={state.uf} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[1.5rem_11rem_minmax(0,1fr)_auto]">
                  <span className="font-data text-xs text-muted-foreground">{index + 1}º</span>
                  <span className="truncate text-sm font-medium text-foreground">
                    {UF_NAMES[state.uf] ?? state.uf}
                  </span>
                  <span aria-hidden="true" className="col-span-3 h-2 overflow-hidden rounded-full bg-muted sm:col-span-1 sm:col-start-3 sm:row-start-1">
                    <span
                      className={cn("block h-full rounded-full", index < 2 ? "bg-destructive" : "bg-warning")}
                      style={{ width: `${Math.max(2, (state.ytd / topMax) * 100)}%` }}
                    />
                  </span>
                  <span className="col-start-3 row-start-1 whitespace-nowrap text-right font-data text-sm sm:col-start-4">
                    <span className="font-semibold text-foreground">{state.ytd.toLocaleString("pt-BR")}</span>
                    <span className="text-muted-foreground"> · {pct(state.share)}</span>
                    <span className={cn("ml-2 text-xs", (state.change ?? 0) > 0 ? "text-destructive" : "text-success")}>{signed(state.change)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </Section>

        <Section title="Quando o risco é maior" description="Horários, dias e cargas mais visados no 1º semestre de 2026 (nstech).">
          <div className="stagger grid gap-4 md:grid-cols-3">
            <StatCard label="Dia mais perigoso" value={peakDay} icon={CalendarDays} tone="warning" hint={peakDayShare ? `${peakDayShare} dos roubos da semana` : undefined} />
            <StatCard label="Horário mais perigoso" value={peakHour} icon={Moon} tone="warning" hint={peakHourShare ? `${peakHourShare} dos roubos` : undefined} />
            <Card className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-medium text-muted-foreground">Cargas mais roubadas</h3>
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Package className="h-[1.125rem] w-[1.125rem]" />
                </span>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {nationalStats.topTargets.map((target) => (
                  <li key={target}>
                    <Badge variant="secondary" className="text-[0.8125rem]">
                      {target}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </Section>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Fontes: <a href={cargoTheftSource.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">{cargoTheftSource.source}</a>{" "}
          (casos por estado até {t.latestMonthLabel}, consultado em {updated}); ISP-RJ e SSP-SP (municípios e regiões); NTC&amp;Logística 2025 e nstech 1º sem. 2026 (prejuízo, horários e cargas). Os
          números são do país inteiro, não só da sua operação.
        </p>
      </div>
    </>
  );
}
