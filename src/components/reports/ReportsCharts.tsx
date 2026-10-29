import { AlertTriangle, PackageSearch, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/patterns";
import { getOccurrenceLabel } from "@/hooks/useSLADB";
import { formatSLA } from "@/lib/formatSLA";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { axisLine, axisTick, BAD, chartScale, fmtNumber, fmtPercent, GOOD, gridProps, tooltipCursor, tooltipItemStyle, tooltipLabelStyle, tooltipStyle } from "./chartTheme";
import { ChartFrame, ReportCard, WrappedTick } from "./ReportCard";

interface SLADataPoint {
  month: string;
  sla: number;
}

interface IssueDataPoint {
  reason: string;
  count: number;
  percentage: number;
}

interface ReportsChartsProps {
  slaData: SLADataPoint[];
  issuesData: IssueDataPoint[];
  isLoading?: boolean;
}

/** Motivos de ocorrencia (Pareto) e, quando houver, a tendencia mensal do SLA. */
export function ReportsCharts({ slaData, issuesData, isLoading }: ReportsChartsProps) {
  if (isLoading) {
    return (
      <div role="status" aria-label="Carregando" className={cn("grid gap-6", slaData.length > 0 && "lg:grid-cols-2")}>
        <Skeleton className="h-[380px] rounded-lg" />
        {slaData.length > 0 && <Skeleton className="h-[380px] rounded-lg" />}
      </div>
    );
  }

  const totalIssues = issuesData.reduce((acc, d) => acc + d.count, 0);
  const bars = issuesData.map((d) => ({ ...d, label: getOccurrenceLabel(d.reason) }));
  const top = bars[0];
  const issuesSummary = top
    ? `Gráfico de barras com os motivos de ocorrência. O mais comum é ${top.label}, com ${top.count} de ${totalIssues} ocorrências (${fmtPercent(top.percentage)}). ` +
      bars
        .slice(1)
        .map((d) => `${d.label}: ${d.count}`)
        .join("; ")
    : "Sem ocorrências no período.";

  return (
    <div className={cn("grid gap-6", slaData.length > 0 && "lg:grid-cols-2")}>
      {/* Tendencia mensal do SLA (so quando a tela passa os dados) */}
      {slaData.length > 0 && (
        <ReportCard
          icon={TrendingUp}
          tone="success"
          title="Tendência do SLA"
          description="SLA de cada mês."
          actions={
            <Badge variant="success" className="font-data">
              {formatSLA(slaData[slaData.length - 1]?.sla || 0)}% agora
            </Badge>
          }
        >
          <ChartFrame
            height={300}
            summary={`Gráfico de área do SLA por mês: ${slaData.map((d) => `${d.month} ${formatSLA(d.sla)}%`).join("; ")}.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={slaData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="slaTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GOOD} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={GOOD} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} vertical={false} />
                <XAxis dataKey="month" tick={axisTick} axisLine={axisLine} tickLine={false} />
                <YAxis domain={[80, 100]} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  formatter={(value: number) => [`${formatSLA(value)}%`, "SLA"]}
                />
                <Area type="monotone" dataKey="sla" name="SLA" stroke={GOOD} strokeWidth={2} fill="url(#slaTrendFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartFrame>
        </ReportCard>
      )}

      {/* Pareto de ocorrencias */}
      <ReportCard
        icon={AlertTriangle}
        tone="warning"
        title="Motivos de ocorrência"
        description="Os motivos que mais geraram ocorrência no período, do mais comum para o menos comum."
        actions={
          totalIssues > 0 ? (
            <Badge variant="secondary" className="font-data">
              {fmtNumber(totalIssues)} ocorrência{totalIssues === 1 ? "" : "s"}
            </Badge>
          ) : undefined
        }
      >
        {bars.length > 0 ? (
          <ChartFrame height={Math.max(160, bars.length * 52 + 40)} summary={issuesSummary}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={10}>
                <CartesianGrid {...gridProps} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={axisLine} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={Math.round(128 * chartScale())}
                  tick={<WrappedTick maxChars={18} />}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={tooltipCursor}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  formatter={(value: number, _name, item) => [
                    `${fmtNumber(value)} (${fmtPercent((item?.payload as IssueDataPoint | undefined)?.percentage ?? 0)})`,
                    "Ocorrências",
                  ]}
                />
                <Bar dataKey="count" name="Ocorrências" fill={BAD} radius={[0, 4, 4, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        ) : (
          <EmptyState
            compact
            icon={PackageSearch}
            title="Nenhuma ocorrência no período"
            description="Boa notícia. Se esperava ver algo aqui, mude o período ou os filtros no topo."
          />
        )}
      </ReportCard>
    </div>
  );
}
