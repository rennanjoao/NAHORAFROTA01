import { useRef, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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

export function ImportDriversDialog({ open, onOpenChange, existingCpfs, remainingSlots, onImported }: ImportDriversDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    const blob = new Blob(["\uFEFF" + DRIVER_IMPORT_TEMPLATE], { type: "text/csv;charset=utf-8" });
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
          title: "Colunas obrigatórias ausentes",
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
        title: "✅ Importação concluída",
        description: `${result.imported} motorista(s) cadastrado(s)${result.failed.length ? `, ${result.failed.length} com erro` : ""}.`,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar motoristas
          </DialogTitle>
          <DialogDescription>
            Planilha .xlsx ou .csv com as colunas Nome, CPF e Telefone (as demais são opcionais). Os motoristas entram sem
            login do app; o acesso pode ser criado depois, na edição de cada um.
          </DialogDescription>
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
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">{outcome.imported} motorista(s) importado(s)</span>
            </div>
            {outcome.failed.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-1">
                <p className="font-medium text-destructive">Não importados:</p>
                {outcome.failed.map((f) => (
                  <p key={`${f.line}-${f.name}`} className="text-muted-foreground">
                    {f.line ? `Linha ${f.line} – ${f.name}: ` : ""}
                    {f.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-8 text-center">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => fileInputRef.current?.click()} disabled={isReading}>
                {isReading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Escolher planilha
              </Button>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Baixar modelo
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{fileName}</span>
              <Badge variant="outline" className="border-success/40 text-success">
                {validRows.length} pronta(s)
              </Badge>
              {invalidRows.length > 0 && (
                <Badge variant="outline" className="border-destructive/40 text-destructive">
                  {invalidRows.length} com erro
                </Badge>
              )}
              <Button variant="link" size="sm" className="h-auto p-0" onClick={reset} disabled={isImporting}>
                Trocar arquivo
              </Button>
            </div>
            {overLimit > 0 && (
              <p className="text-sm text-warning">
                Seu plano permite mais {Math.max(0, remainingSlots)} motorista(s): {overLimit} linha(s) válida(s) ficarão de fora.
              </p>
            )}
            <ScrollArea className="h-[320px] rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Linha</th>
                    <th className="px-3 py-2 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium">CPF</th>
                    <th className="px-3 py-2 font-medium">Veículo</th>
                    <th className="px-3 py-2 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.line} className="border-t">
                      <td className="px-3 py-2 text-muted-foreground">{row.line}</td>
                      <td className="px-3 py-2">{row.data.name || "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.data.cpf || "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {row.data.vehicleType} • {row.data.vehiclePlate}
                      </td>
                      <td className="px-3 py-2">
                        {row.errors.length === 0 ? (
                          <span className="flex items-center gap-1 text-success">
                            <CheckCircle2 className="h-4 w-4" /> OK
                          </span>
                        ) : (
                          <span className="flex items-start gap-1 text-destructive">
                            <XCircle className="h-4 w-4 shrink-0 mt-0.5" /> {row.errors.join("; ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          {outcome ? (
            <Button onClick={() => handleOpenChange(false)}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isImporting}>
                Cancelar
              </Button>
              {rows.length > 0 && (
                <Button onClick={handleImport} disabled={isImporting || limitedRows.length === 0}>
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importando {progress}/{limitedRows.length}...
                    </>
                  ) : (
                    `Importar ${limitedRows.length} motorista(s)`
                  )}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
