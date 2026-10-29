import { useRef, useState } from "react";
import { CheckCircle2, Download, Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/patterns";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { requireCurrentTenantId } from "@/lib/tenant";
import { onlyDigits } from "@/lib/documentValidation";
import { readSpreadsheet, SpreadsheetError } from "@/lib/spreadsheet";
import {
  DRIVER_IMPORT_TEMPLATE,
  DriverImportRow,
  FIELD_LABELS,
  parseDriverRows,
} from "@/lib/driverImport";
import { useReturnFocus } from "@/hooks/useReturnFocus";
import { DRIVER_VEHICLE_TYPES, PENDING_PLATE } from "./driverConfig";

interface ImportDriversDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCpfs: string[];
  /** Vagas restantes no plano (-1 = ilimitado). */
  remainingSlots: number;
  onImported: () => void;
}

interface ImportOutcome {
  imported: number;
  failed: { line: number; name: string; message: string }[];
}

const plural = (count: number, one: string, many: string) => `${count.toLocaleString("pt-BR")} ${count === 1 ? one : many}`;

// Mesmo texto da lista de motoristas: "Van · ABC1D23", "Veículo da empresa" (CLT sem placa).
function vehicleText({ vehicleType, vehiclePlate, isOwnFleet }: DriverImportRow["data"]) {
  const hasPlate = vehiclePlate && vehiclePlate !== PENDING_PLATE;
  if (isOwnFleet && !hasPlate) return "CLT · Veículo da empresa";
  const label = DRIVER_VEHICLE_TYPES.find((type) => type.toLowerCase() === vehicleType) ?? vehicleType;
  return `${isOwnFleet ? "CLT · " : ""}${label} · ${hasPlate ? vehiclePlate : "Placa pendente"}`;
}

function Step({ number, title, description, children }: { number: number; title: string; description: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-data text-sm font-semibold text-primary">
          {number}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            <span className="sr-only">Passo {number}: </span>
            {title}
          </p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0 [&>*]:w-full sm:[&>*]:w-auto">{children}</div>
    </li>
  );
}

export function ImportDriversDialog({ open, onOpenChange, existingCpfs, remainingSlots, onImported }: ImportDriversDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useReturnFocus();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<DriverImportRow[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);
  const limitedRows = remainingSlots === -1 ? validRows : validRows.slice(0, Math.max(0, remainingSlots));
  const overLimit = validRows.length - limitedRows.length;

  const reset = () => {
    setFileName("");
    setRows([]);
    setOutcome(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (next: boolean) => {
    if (isImporting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const downloadTemplate = () => {
    // BOM para o Excel abrir os acentos corretamente.
    const blob = new Blob(["﻿" + DRIVER_IMPORT_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo-motoristas.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsReading(true);
    setOutcome(null);
    try {
      const sheet = await readSpreadsheet(file);
      const existing = new Set(existingCpfs.map(onlyDigits).filter(Boolean));
      const parsed = parseDriverRows(sheet, existing);
      if (parsed.missingColumns.length) {
        toast({
          title: "Faltam colunas obrigatórias",
          description: `A primeira linha precisa ter: ${parsed.missingColumns.map((f) => FIELD_LABELS[f]).join(", ")}. Baixe o modelo para ver o formato.`,
          variant: "destructive",
        });
        reset();
        return;
      }
      if (!parsed.rows.length) {
        toast({ title: "Planilha vazia", description: "Nenhum motorista encontrado abaixo do cabeçalho.", variant: "destructive" });
        reset();
        return;
      }
      setFileName(file.name);
      setRows(parsed.rows);
    } catch (error) {
      if (!(error instanceof SpreadsheetError)) console.error("Error reading spreadsheet:", error);
      toast({
        title: "Não foi possível ler a planilha",
        description: error instanceof SpreadsheetError ? error.message : "Confira se o arquivo é um .xlsx ou .csv válido.",
        variant: "destructive",
      });
      reset();
    } finally {
      setIsReading(false);
    }
  };

  const handleImport = async () => {
    if (!limitedRows.length) return;
    setIsImporting(true);
    setProgress(0);
    const result: ImportOutcome = { imported: 0, failed: [] };

    try {
      const tenantId = await requireCurrentTenantId();
      for (const [index, row] of limitedRows.entries()) {
        const { data } = row;
        const { error } = await supabase.from("drivers").insert({
          name: data.name,
          cpf: data.cpf,
          phone: data.phone,
          contact_email: data.contactEmail,
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(data.name)}`,
          vehicle_plate: data.vehiclePlate,
          vehicle_type: data.vehicleType,
          cnh: data.cnh,
          cnh_category: data.cnhCategory,
          status: "active",
          is_own_fleet: data.isOwnFleet,
          daily_sla: 100,
          individual_sla: 100,
          deliveries_completed: 0,
          total_deliveries: 0,
          current_delay: 0,
          tenant_id: tenantId,
        });
        if (error) {
          result.failed.push({ line: row.line, name: data.name, message: error.message });
          // Limite do plano atingido no banco: as proximas linhas falhariam igual.
          if (/limite/i.test(error.message)) break;
        } else {
          result.imported++;
        }
        setProgress(index + 1);
      }
    } catch (error) {
      result.failed.push({ line: 0, name: "", message: error instanceof Error ? error.message : "Erro ao importar" });
    } finally {
      setIsImporting(false);
    }

    setOutcome(result);
    if (result.imported > 0) {
      onImported();
      toast({
        title: "Importação concluída",
        description: `${plural(result.imported, "motorista cadastrado", "motoristas cadastrados")}${result.failed.length ? `, ${result.failed.length} com erro` : ""}.`,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent {...returnFocus} className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar motoristas</DialogTitle>
          <DialogDescription>Cadastre vários motoristas de uma vez com uma planilha .xlsx ou .csv.</DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv,.xls"
          className="hidden"
          onChange={handleFile}
          aria-label="Arquivo da planilha"
        />

        {outcome ? (
          <div className="space-y-3" role="status">
            <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-success" aria-hidden="true" />
              <p className="font-medium text-foreground">{plural(outcome.imported, "motorista importado", "motoristas importados")}</p>
            </div>
            {outcome.failed.length > 0 && (
              <Alert variant="destructive">
                <p className="mb-1 font-semibold leading-snug text-foreground">Não importados</p>
                <AlertDescription>
                  <ul className="mt-1 space-y-1">
                    {outcome.failed.map((f) => (
                      <li key={`${f.line}-${f.name}`}>
                        {f.line ? `Linha ${f.line}, ${f.name}: ` : ""}
                        {f.message}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : rows.length === 0 ? (
          <div className="space-y-3">
            <ol className="space-y-3">
              <Step number={1} title="Baixe o modelo" description="Nome, CPF e Telefone são obrigatórios. As outras colunas são opcionais.">
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download aria-hidden="true" />
                  Baixar modelo
                </Button>
              </Step>
              <Step number={2} title="Envie a planilha preenchida" description="Você confere a lista antes de importar.">
                <Button onClick={() => fileInputRef.current?.click()} disabled={isReading}>
                  {isReading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                  {isReading ? "Lendo..." : "Escolher planilha"}
                </Button>
              </Step>
            </ol>
            <p className="text-xs text-muted-foreground">Os motoristas entram sem acesso ao aplicativo.</p>
          </div>
        ) : (
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 truncate font-medium text-foreground" title={fileName}>
                {fileName}
              </span>
              <StatusBadge tone="success">{plural(validRows.length, "pronta", "prontas")}</StatusBadge>
              {invalidRows.length > 0 && <StatusBadge tone="danger">{invalidRows.length} com erro</StatusBadge>}
              <Button variant="link" size="sm" className="h-auto px-1" onClick={reset} disabled={isImporting}>
                Trocar arquivo
              </Button>
            </div>
            {overLimit > 0 && (
              <Alert variant="warning">
                <AlertDescription>
                  Seu plano permite mais {plural(Math.max(0, remainingSlots), "motorista", "motoristas")}:{" "}
                  {plural(overLimit, "linha pronta fica", "linhas prontas ficam")} de fora.
                </AlertDescription>
              </Alert>
            )}
            {isImporting && (
              <Progress value={(progress / Math.max(1, limitedRows.length)) * 100} aria-label={`Importando ${progress} de ${limitedRows.length}`} className="h-1.5" />
            )}
            <div className="max-h-[min(20rem,45dvh)] overflow-auto rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" tabIndex={0} role="region" aria-label="Linhas da planilha">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                  <tr className="text-left">
                    <th scope="col" className="w-14 px-3 py-2 font-semibold">Linha</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Motorista</th>
                    <th scope="col" className="hidden px-3 py-2 font-semibold sm:table-cell">Veículo</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => (
                    <tr key={row.line} className="align-top">
                      <td className="px-3 py-2 font-data text-muted-foreground">{row.line}</td>
                      <td className="px-3 py-2">
                        <p className="whitespace-nowrap text-foreground">{row.data.name || "Sem nome"}</p>
                        <p className="whitespace-nowrap font-data text-xs text-muted-foreground">{row.data.cpf || "Sem CPF"}</p>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2 text-xs leading-5 text-muted-foreground sm:table-cell">
                        {vehicleText(row.data)}
                      </td>
                      <td className="px-3 py-2">
                        {row.errors.length === 0 ? (
                          <StatusBadge tone="success">Pronta</StatusBadge>
                        ) : (
                          <div className="space-y-1">
                            <StatusBadge tone="danger">Com erro</StatusBadge>
                            <ul className="space-y-0.5 text-xs text-destructive">
                              {row.errors.map((message) => (
                                <li key={message}>{message}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          {outcome ? (
            <Button onClick={() => handleOpenChange(false)}>Concluir</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isImporting}>
                Cancelar
              </Button>
              {rows.length > 0 && (
                <Button onClick={handleImport} disabled={isImporting || limitedRows.length === 0}>
                  {isImporting && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {isImporting
                    ? `Importando ${progress} de ${limitedRows.length}...`
                    : `Importar ${plural(limitedRows.length, "motorista", "motoristas")}`}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
