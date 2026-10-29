import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Pencil, Plus, Receipt, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog, EmptyState, Section, StatusBadge } from "@/components/patterns";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
import { categoryLabels, type AdjustmentCategory, type LocalAdjustment } from "./settlementConfig";

interface AdjustmentsPanelProps {
  adjustments: LocalAdjustment[];
  /** Mostra o botao de adicionar (so para agregados). */
  canAdd: boolean;
  onAdd: () => void;
  onEdit: (adjustment: LocalAdjustment) => void;
  onRemove: (adjustmentId: string) => Promise<void>;
  onSetPaid: (adjustment: LocalAdjustment, paid: boolean) => void;
}

const signed = (adj: LocalAdjustment) => `${adj.type === "credit" ? "+" : ""}${formatCurrency(adj.value)}`;

/** Creditos e debitos avulsos do motorista (vale, bonus, pedagio...). */
export function AdjustmentsPanel({ adjustments, canAdd, onAdd, onEdit, onRemove, onSetPaid }: AdjustmentsPanelProps) {
  const [toRemove, setToRemove] = useState<LocalAdjustment | null>(null);
  const [removing, setRemoving] = useState(false);

  const confirmRemove = async () => {
    if (!toRemove) return;
    const index = adjustments.findIndex((adj) => adj.id === toRemove.id);
    setRemoving(true);
    await onRemove(toRemove.id);
    setRemoving(false);
    setToRemove(null);
    // A linha excluida levava o foco: passa para a linha vizinha (ou para o nome do motorista).
    window.setTimeout(() => {
      const rows = [...document.querySelectorAll<HTMLElement>("[data-adjustment-action]")].filter((el) => el.getClientRects().length > 0);
      (rows[Math.min(Math.max(0, index), rows.length - 1)] ?? document.getElementById("acerto-motorista"))?.focus();
    }, 50);
  };

  const detail = (adj: LocalAdjustment) =>
    `${categoryLabels[(adj.category || "other") as AdjustmentCategory]}${adj.observation ? ` · ${adj.observation}` : ""}`;

  const actions = (adj: LocalAdjustment, full?: boolean) => {
    const isPaid = adj.status === "paid";
    return (
      <div className={full ? "flex items-center gap-2" : "flex items-center justify-end gap-1.5"}>
        {!isPaid && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size={full ? "icon" : "icon-sm"}
                  variant={full ? "outline" : "ghost"}
                  aria-label={`Editar lançamento ${adj.description}`}
                  onClick={() => onEdit(adj)}
                >
                  <Pencil aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size={full ? "icon" : "icon-sm"}
                  variant={full ? "outline" : "ghost"}
                  aria-label={`Excluir lançamento ${adj.description}`}
                  className="text-destructive hover:text-destructive"
                  onClick={() => setToRemove(adj)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Excluir</TooltipContent>
            </Tooltip>
          </>
        )}
        {/* Botao principal por ultimo: "Quitar" e "Reabrir" ficam alinhados na mesma coluna. */}
        <Button
          size={full ? "default" : "sm"}
          variant={isPaid ? "outline" : "soft"}
          className={full ? "flex-1" : undefined}
          data-adjustment-action=""
          onClick={() => onSetPaid(adj, !isPaid)}
        >
          {isPaid ? <RotateCcw aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
          {isPaid ? "Reabrir" : "Quitar"}
        </Button>
      </div>
    );
  };

  return (
    <Section
      id="lancamentos"
      title="Créditos e débitos"
      description="Valores avulsos que somam ou descontam do saldo, como vale combustível ou ajuda de descarga."
      actions={
        canAdd && adjustments.length > 0 ? (
          <Button variant="outline" size="sm" onClick={onAdd}>
            <Plus aria-hidden="true" />
            Adicionar lançamento
          </Button>
        ) : undefined
      }
    >
      {adjustments.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon={Receipt}
            title="Nenhum crédito ou débito"
            description="Use para descontar um vale ou pagar um extra, como descarga ou pedágio."
            action={
              canAdd ? (
                <Button variant="outline" onClick={onAdd}>
                  <Plus aria-hidden="true" />
                  Adicionar lançamento
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          {/* Computador */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.map((adj) => (
                  <TableRow key={adj.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{adj.description}</p>
                      <p className="text-xs text-muted-foreground">{detail(adj)}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(adj.date, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={adj.status === "paid" ? "success" : "warning"}>
                        {adj.status === "paid" ? "Pago" : "A pagar"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "whitespace-nowrap text-right font-data font-semibold",
                        adj.type === "credit" ? "text-success" : "text-destructive",
                      )}
                    >
                      {signed(adj)}
                      <span className="sr-only">{adj.type === "credit" ? " (crédito)" : " (débito)"}</span>
                    </TableCell>
                    <TableCell className="text-right">{actions(adj)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Celular */}
          <ul className="stagger space-y-3 md:hidden">
            {adjustments.map((adj) => (
              <li key={adj.id}>
                <Card className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{adj.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(adj.date, "dd/MM/yyyy HH:mm", { locale: ptBR })} · {detail(adj)}
                      </p>
                    </div>
                    <StatusBadge tone={adj.status === "paid" ? "success" : "warning"}>
                      {adj.status === "paid" ? "Pago" : "A pagar"}
                    </StatusBadge>
                  </div>
                  <p
                    className={cn(
                      "font-data text-xl font-semibold",
                      adj.type === "credit" ? "text-success" : "text-destructive",
                    )}
                  >
                    {signed(adj)}
                    <span className="ml-1.5 text-xs font-medium text-muted-foreground">
                      {adj.type === "credit" ? "crédito" : "débito"}
                    </span>
                  </p>
                  {actions(adj, true)}
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={Boolean(toRemove)}
        onOpenChange={(open) => !open && !removing && setToRemove(null)}
        tone="danger"
        title="Excluir este lançamento?"
        description={
          toRemove
            ? `"${toRemove.description}" (${signed(toRemove)}) sai do extrato do motorista. Não dá para desfazer.`
            : undefined
        }
        confirmLabel="Excluir lançamento"
        loading={removing}
        onConfirm={confirmRemove}
      />
    </Section>
  );
}
