import { Check, Minus } from "lucide-react";
import { PLANS } from "@/config/plans";

type Cell = boolean | string;
/* Linhas da planilha de planos (29/10/2026), agrupadas por assunto. */
const ROWS: { group: string; items: [string, Cell, Cell, Cell][] }[] = [
  {
    group: "Painel",
    items: [
      ["Motoristas na rua, mercadorias em rota, notas carregadas e entregas feitas", true, true, true],
      ["Entregas não roteirizadas e status das notas", true, true, true],
      ["Frota própria e de terceiros, motoristas que finalizaram", true, true, true],
      ["SLA em tempo real", false, true, true],
      ["Receita total, custo do frete de terceiros e eficiência do frete", false, true, true],
      ["SLA por motorista: quem está abaixo hoje", false, false, true],
      ["Motoristas que pedem atenção (nota de 0 a 5)", false, false, true],
    ],
  },
  {
    group: "Mapa e alertas",
    items: [
      ["Mapa da frota", false, "A cada 30 min", "Tempo real"],
      ["Áreas de alerta (cerca) com o status dos motoristas", false, "A cada 30 min", "Tempo real"],
    ],
  },
  {
    group: "Entregas e romaneio",
    items: [
      ["Importação de notas por XML", true, true, true],
      ["Importação de pedidos por planilha (pedido, cliente, endereço, CEP, telefone, peso)", true, true, true],
      ["Ordem do romaneio", "Sequência escolhida", "Melhor trajeto", "Roteirizador avançado"],
      ["Devolvidos voltam para um novo romaneio", true, true, true],
      ["Regiões separadas para ver e roteirizar", true, true, true],
    ],
  },
  {
    group: "Motoristas e veículos",
    items: [
      ["Motoristas e veículos incluídos", "3", "15", "50"],
      ["Motorista além do limite", "R$ 10/mês", "R$ 10/mês", "R$ 10/mês"],
      ["Usuários no painel", "5", "20", "Ilimitado"],
      ["Documentos do motorista para baixar", true, true, true],
      ["Tipo de veículo: peso das notas, restrição de circulação e alerta de rodízio", false, false, true],
    ],
  },
  {
    group: "Financeiro",
    items: [
      ["Acerto financeiro em lote, com recibo", true, true, true],
      ["Baixa em lote e comprovante de pagamento", true, true, true],
      ["Relatório de pagamento e motoristas que mais faturaram", false, false, true],
      ["Aviso ao financeiro quando o motorista deixa de entregar", false, false, true],
    ],
  },
  {
    group: "Relatórios",
    items: [
      ["Uso da frota", true, true, true],
      ["Desempenho e eficiência", false, true, true],
      ["Rentabilidade", false, false, true],
      ["Exportar relatórios", false, false, true],
    ],
  },
];

function Value({ v }: { v: Cell }) {
  if (typeof v === "string") return <span className="font-data text-[0.8rem] font-semibold">{v}</span>;
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
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
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
