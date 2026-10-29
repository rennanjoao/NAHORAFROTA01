import { AlertTriangle, CalendarDays, Moon, Package, ShieldAlert, TrendingUp, Wallet, MapPinned } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader, Section, StatCard } from "@/components/patterns";
import { BrasilRiskMap } from "@/components/dashboard/BrasilRiskMap";
import { nationalStats } from "@/components/dashboard/riskZones";

/** "Sexta-feira (23,2%)" -> ["Sexta-feira", "23,2%"] */
function splitStat(text: string): [string, string] {
  const match = /^(.*?)\s*\((.*)\)$/.exec(text);
  return match ? [match[1], match[2]] : [text, ""];
}

export default function RoutesPage() {
  const [peakDay, peakDayShare] = splitStat(nationalStats.peakDay);
  const [peakHour, peakHourGrowth] = splitStat(nationalStats.peakHour);

  return (
    <>
      <PageHeader
        icon={ShieldAlert}
        title="Áreas de risco"
        description="Onde mais acontecem roubos de carga no Brasil, para planejar rotas e horários mais seguros."
      />

      <div className="space-y-8 md:space-y-10">
        <BrasilRiskMap />

        <Section title="O Brasil em números" description="Roubo de carga em 2024 e no primeiro semestre de 2025.">
          <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Roubos de carga em 2024" value={nationalStats.totalOccurrences2024} icon={AlertTriangle} tone="danger" hint="Casos registrados no país" />
            <StatCard label="Prejuízo estimado" value={nationalStats.estimatedLoss} icon={Wallet} tone="neutral" hint="Em 2024" />
            <StatCard label="Aumento em 2025" value={nationalStats.growth2025} icon={TrendingUp} tone="danger" hint="1º semestre, comparado a 2024" />
            <StatCard label="Prejuízo no Sudeste" value={nationalStats.sudeste} icon={MapPinned} tone="warning" hint="Do total do país" />
          </div>
        </Section>

        <Section title="Quando o risco é maior" description="Evite estes dias e horários para cargas de alto valor.">
          <div className="stagger grid gap-4 md:grid-cols-3">
            <StatCard label="Dia mais perigoso" value={peakDay} icon={CalendarDays} tone="warning" hint={peakDayShare ? `${peakDayShare} dos roubos da semana` : undefined} />
            <StatCard label="Horário mais perigoso" value={peakHour} icon={Moon} tone="warning" hint={peakHourGrowth ? `${peakHourGrowth} de casos em 2025` : undefined} />
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

        <p className="text-xs text-muted-foreground">
          Fontes: relatórios nstech 2024/2025, AAAPV, Buonny e ISTOÉ Dinheiro. Os números são do país inteiro, não só da sua operação.
        </p>
      </div>
    </>
  );
}
