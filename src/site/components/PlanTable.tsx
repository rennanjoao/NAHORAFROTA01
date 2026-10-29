import { Check, Minus } from "lucide-react";
import { PLANS } from "@/config/plans";

type Cell = boolean | string;
const ROWS: { group: string; items: [string, Cell, Cell, Cell][] }[] = [
  {
    group: "Operação",
    items: [
      ["Mapa ao vivo da frota", true, true, true],
      ["Romaneio digital e despacho", true, true, true],
      ["App do motorista com canhoto, foto e assinatura", true, true, true],
      ["Ocorrências de entrega com registro na hora", true, true, true],
      ["Painel com atualização automática", false, true, true],
      ["Importação de notas em lote (XML da NF-e)", false, true, true],
      ["Áreas de alerta no mapa", false, true, true],
    ],
  },
  {
    group: "Prazo e números",
    items: [
      ["SLA semanal por motorista e região", false, true, true],
      ["Relatórios de eficiência e evolução do prazo", false, true, true],
      ["SLA por entrega e motorista (drill-down)", false, false, true],
      ["Relatórios financeiros e lucratividade por rota", false, false, true],
    ],
  },
  {
    group: "Financeiro e suporte",
    items: [
      ["Acerto: frete, adiantamento e desconto por romaneio", false, false, true],
      ["Atendimento prioritário", false, false, true],
    ],
  },
  {
    group: "Limites",
    items: [
      ["Usuários no painel", "5", "20", "Ilimitado"],
      ["Motoristas", "50", "200", "Ilimitado"],
      ["Veículos", "20", "100", "Ilimitado"],
    ],
  },
];

function Value({ v }: { v: Cell }) {
  if (typeof v === "string") return <span className="font-data font-semibold">{v}</span>;
  return v ? (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-nhf-ink">
      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-label="Incluído" />
    </span>
  ) : (
    <Minus className="mx-auto h-4 w-4 text-muted-foreground" aria-label="Não incluído" />
  );
}

/** Tabela completa de recursos por plano. */
export function PlanTable({ id }: { id: string }) {
  return (
    <div id={id} className="site-card overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">Recursos e limites de cada plano</caption>
        <thead>
          <tr className="border-b border-foreground/10">
            <th scope="col" className="px-5 py-4 font-heading text-base font-semibold">Recursos</th>
            {PLANS.map((p) => (
              <th key={p.id} scope="col" className="px-5 py-4 text-center font-heading text-base font-semibold">
                {p.name}
                <span className="block font-data text-xs font-normal text-muted-foreground">R$ {p.amountCents / 100}/mês</span>
              </th>
            ))}
          </tr>
        </thead>
        {ROWS.map((g) => (
          <tbody key={g.group}>
            <tr>
              <th scope="colgroup" colSpan={4} className="bg-muted/60 px-5 py-2 label-caps text-muted-foreground">{g.group}</th>
            </tr>
            {g.items.map(([label, a, b, c]) => (
              <tr key={label} className="border-t border-foreground/5">
                <th scope="row" className="px-5 py-3 font-normal text-foreground/85">{label}</th>
                {[a, b, c].map((v, i) => (
                  <td key={i} className="px-5 py-3 text-center"><Value v={v} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
