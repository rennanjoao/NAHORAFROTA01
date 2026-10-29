import { useState, useCallback, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusBadge } from "@/components/patterns";
import {
  Upload,
  FileUp,
  CheckCircle2,
  Info,
  Loader2,
  MapPin,
  MapPinOff,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { parseMultipleXmls, ParseResult, ParsedNFeData } from "@/lib/nfeXmlParser";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { calculateRegiaoLogistica } from "@/lib/cepRegionMapping";
import { requireCurrentTenantId } from "@/lib/tenant";
import { WizardSteps } from "./WizardSteps";

interface XMLImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (imported: number, duplicates: number) => void;
}

interface ProcessedInvoice extends ParsedNFeData {
  id: string;
  selected: boolean;
  isDuplicate: boolean;
  duplicateSource?: "database" | "batch";
  isGeocoded: boolean;
  latitude: number | null;
  longitude: number | null;
  geocodeError?: string;
}

type ImportStep = "upload" | "processing" | "review" | "importing" | "complete";

export function XMLImportDialog({ open, onOpenChange, onImportComplete }: XMLImportDialogProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [parseResults, setParseResults] = useState<ParseResult[]>([]);
  const [processedInvoices, setProcessedInvoices] = useState<ProcessedInvoice[]>([]);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [importedCount, setImportedCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [importErrorDetails, setImportErrorDetails] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  // A cada etapa o botao clicado some: leva o foco para o novo conteudo
  // (antes caia na janela inteira, com contorno verde em volta de tudo).
  useEffect(() => {
    if (!open) return;
    const target =
      step === "processing" || step === "importing"
        ? statusRef.current
        : step === "review"
          ? reviewRef.current
          : step === "complete"
            ? doneRef.current
            : null;
    target?.focus({ preventScroll: true });
  }, [step, open]);

  // Reset state when dialog closes
  const handleOpenChange = (open: boolean) => {
    // Enquanto salva, nao fecha (as notas seguiriam sendo gravadas sem aviso).
    if (!open && step === "importing") return;
    if (!open) {
      setStep("upload");
      setFiles([]);
      setParseResults([]);
      setProcessedInvoices([]);
      setProgress(0);
      setProgressMessage("");
      setImportedCount(0);
      setDuplicateCount(0);
      setErrorCount(0);
      setImportErrorDetails(null);
    }
    onOpenChange(open);
  };

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.name.toLowerCase().endsWith(".xml")
    );

    if (droppedFiles.length === 0) {
      toast({
        title: "Nenhum arquivo XML",
        description: "Escolha os arquivos das notas fiscais, com final .xml.",
        variant: "destructive",
      });
      return;
    }

    setFiles(droppedFiles);
    processFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(
      (file) => file.name.toLowerCase().endsWith(".xml")
    );
    // Libera o campo para escolher os mesmos arquivos de novo (sem isso nada acontecia).
    e.target.value = "";

    if (selectedFiles.length === 0) {
      toast({
        title: "Nenhum arquivo XML",
        description: "Escolha os arquivos das notas fiscais, com final .xml.",
        variant: "destructive",
      });
      return;
    }

    setFiles(selectedFiles);
    processFiles(selectedFiles);
  };

  // Process uploaded files
  const processFiles = async (filesToProcess: File[]) => {
    setStep("processing");
    setProgress(0);
    setProgressMessage("Lendo os arquivos XML…");

    try {
      // Parse XML files
      const results = await parseMultipleXmls(filesToProcess);
      setParseResults(results);
      setProgress(30);

      const successfulResults = results.filter((r) => r.success && r.data);
      const failedResults = results.filter((r) => !r.success);
      setErrorCount(failedResults.length);

      // Show detailed errors for failed files
      if (failedResults.length > 0) {
        console.warn("Failed to parse XML files:", failedResults.map(f => ({
          fileName: f.fileName,
          error: f.error
        })));
      }

      if (successfulResults.length === 0) {
        const errorDetails =
          failedResults.length === 1
            ? `${failedResults[0].fileName}: ${failedResults[0].error || "não é um XML de nota fiscal."}`
            : failedResults.length > 1
              ? `Nenhum dos ${failedResults.length} arquivos é um XML de nota fiscal (NF-e) válido.`
              : "Não foi possível ler nenhum arquivo XML.";
        toast({
          title: "Nenhuma nota válida",
          description: errorDetails,
          variant: "destructive",
        });
        setStep("upload");
        return;
      }

      setProgressMessage("Conferindo se as notas já foram importadas…");
      const tenantId = await requireCurrentTenantId();

      // Check for duplicates in database
      const accessKeys = successfulResults.map((r) => r.data!.accessKey);
      const { data: existingInvoices, error: dupCheckError } = await supabase
        .from("invoices")
        .select("access_key")
        .eq("tenant_id", tenantId)
        .in("access_key", accessKeys);

      if (dupCheckError) {
        console.error("Error checking duplicates:", dupCheckError);
        // Continue anyway - treat as no duplicates
      }

      const existingKeys = new Set(existingInvoices?.map((i) => i.access_key) || []);
      const seenBatchKeys = new Set<string>();
      setProgress(50);

      setProgressMessage("Localizando os endereços no mapa…");

      // Process and geocode each invoice - with concurrency limit to avoid rate limiting
      const processed: ProcessedInvoice[] = [];
      let geocodeProgress = 50;
      const progressPerItem = 40 / successfulResults.length;
      
      // Process in smaller batches to avoid overwhelming the geocode service
      const BATCH_SIZE = 3;
      for (let i = 0; i < successfulResults.length; i += BATCH_SIZE) {
        const batch = successfulResults.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (result) => {
          const data = result.data!;
          const isDatabaseDuplicate = existingKeys.has(data.accessKey);
          const isBatchDuplicate = seenBatchKeys.has(data.accessKey);
          const isDuplicate = isDatabaseDuplicate || isBatchDuplicate;

          if (!isDuplicate) {
            seenBatchKeys.add(data.accessKey);
          }

          let latitude: number | null = null;
          let longitude: number | null = null;
          let geocodeError: string | undefined;

          // Only geocode if not duplicate
          if (!isDuplicate && data.addressFull) {
            try {
              const { data: geocodeResult, error } = await supabase.functions.invoke("geocode-address", {
                body: { address: data.addressFull },
              });

              if (error) {
                console.warn(`Geocode error for ${data.nfeNumber}:`, error.message);
                geocodeError = error.message;
              } else if (geocodeResult?.success) {
                latitude = geocodeResult.latitude;
                longitude = geocodeResult.longitude;
              } else {
                geocodeError = geocodeResult?.error || "Endereço não encontrado";
              }
            } catch (err) {
              console.warn(`Geocode exception for ${data.nfeNumber}:`, err);
              geocodeError = "Erro ao geocodificar";
            }
          }

          return {
            ...data,
            id: crypto.randomUUID(),
            selected: !isDuplicate,
            isDuplicate,
            duplicateSource: isDatabaseDuplicate ? "database" : isBatchDuplicate ? "batch" : undefined,
            isGeocoded: latitude !== null && longitude !== null,
            latitude,
            longitude,
            geocodeError,
          } as ProcessedInvoice;
        });

        const batchResults = await Promise.all(batchPromises);
        processed.push(...batchResults);

        geocodeProgress += progressPerItem * batch.length;
        setProgress(Math.min(90, geocodeProgress));
      }

      setProcessedInvoices(processed);
      setDuplicateCount(processed.filter((p) => p.isDuplicate).length);
      setProgress(100);
      setStep("review");
    } catch (error) {
      console.error("Error processing files:", error);
      toast({
        title: "Não foi possível ler os arquivos",
        description: error instanceof Error ? error.message : "Confira se são XML de nota fiscal e tente de novo.",
        variant: "destructive",
      });
      setStep("upload");
    }
  };

  // Toggle selection
  const toggleSelection = (id: string) => {
    setProcessedInvoices((prev) =>
      prev.map((inv) =>
        inv.id === id && !inv.isDuplicate ? { ...inv, selected: !inv.selected } : inv
      )
    );
  };

  // Select/deselect all
  const toggleSelectAll = (checked: boolean) => {
    setProcessedInvoices((prev) =>
      prev.map((inv) => (!inv.isDuplicate ? { ...inv, selected: checked } : inv))
    );
  };

  // Import selected invoices
  const handleImport = async () => {
    const toImport = processedInvoices.filter((inv) => inv.selected && !inv.isDuplicate);

    if (toImport.length === 0) {
      toast({
        title: "Nenhuma nota marcada",
        description: "Marque pelo menos uma nota para importar.",
        variant: "destructive",
      });
      return;
    }

    setStep("importing");
    setProgress(0);
    setProgressMessage("Salvando as notas fiscais…");

    try {
      const tenantId = await requireCurrentTenantId();
      const invoicesToInsert = toImport.map((inv) => ({
        tenant_id: tenantId,
        access_key: inv.accessKey,
        nfe_number: inv.nfeNumber,
        recipient_name: inv.recipientName,
        recipient_phone: inv.recipientPhone !== 'Não informado' ? inv.recipientPhone : null,
        address_full: inv.addressFull,
        address_street: inv.addressStreet,
        address_number: inv.addressNumber,
        address_neighborhood: inv.addressNeighborhood,
        address_city: inv.addressCity,
        address_state: inv.addressState,
        address_zip: inv.addressZip,
        regiao_logistica: calculateRegiaoLogistica(inv.addressZip),
        latitude: inv.latitude,
        longitude: inv.longitude,
        total_value: inv.totalValue,
        total_weight: inv.totalWeight,
        volume_quantity: inv.volumeQuantity,
        status: "pending",
        xml_raw: inv.xmlRaw,
      }));

      const { data: importedRows, error } = await supabase
        .from("invoices")
        .upsert(invoicesToInsert, {
          onConflict: "tenant_id,access_key",
          ignoreDuplicates: true,
        })
        .select("access_key");

      if (error) {
        throw error;
      }

      const importedNow = importedRows?.length || 0;
      const skippedNow = toImport.length - importedNow;

      setImportedCount(importedNow);
      setProgress(100);
      setStep("complete");

      toast({
        title: "Notas importadas",
        description:
          skippedNow > 0
            ? `${importedNow === 1 ? "1 importada" : `${importedNow} importadas`}; ${skippedNow === 1 ? "1 já existia" : `${skippedNow} já existiam`} no sistema.`
            : importedNow === 1
              ? "1 nota fiscal importada."
              : `${importedNow} notas fiscais importadas.`,
        variant: "success",
      });

      onImportComplete(importedNow, duplicateCount + skippedNow);
    } catch (error) {
      console.error("Error importing invoices:", error);

      const anyErr = error as any;
      const detailsPayload = {
        message: anyErr?.message,
        code: anyErr?.code,
        details: anyErr?.details,
        hint: anyErr?.hint,
      };

      setImportErrorDetails(JSON.stringify(detailsPayload, null, 2));

      toast({
        title: "Não foi possível importar as notas",
        description: "Confira a internet e tente de novo. Os detalhes técnicos ficam na janela.",
        variant: "destructive",
      });
      setStep("review");
    }
  };

  const selectedCount = processedInvoices.filter((inv) => inv.selected && !inv.isDuplicate).length;
  const nonDuplicateCount = processedInvoices.filter((inv) => !inv.isDuplicate).length;
  const failedParseResults = parseResults.filter((result) => !result.success);
  const notGeocodedCount = processedInvoices.filter((inv) => !inv.isDuplicate && !inv.isGeocoded).length;
  const headerChecked: boolean | "indeterminate" =
    nonDuplicateCount > 0 && selectedCount === nonDuplicateCount ? true : selectedCount > 0 ? "indeterminate" : false;

  const stepIndex = step === "upload" || step === "processing" ? 0 : step === "complete" ? 2 : 1;
  const stepDescription: Record<ImportStep, string> = {
    upload: "Escolha os arquivos XML das notas fiscais (NF-e). Pode enviar vários de uma vez.",
    processing: "Lendo os arquivos e conferindo os endereços.",
    review: "Confira as notas antes de importar. Notas repetidas ficam de fora.",
    importing: "Salvando as notas fiscais.",
    complete: "Pronto. As notas já estão na lista.",
  };
  const notesLabel = (count: number) => (count === 1 ? "1 nota" : `${count} notas`);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar notas fiscais</DialogTitle>
          <DialogDescription>{stepDescription[step]}</DialogDescription>
        </DialogHeader>

        <WizardSteps steps={["Escolher arquivos", "Conferir notas", "Pronto"]} current={stepIndex} />

        {/* Campo de arquivo escondido: aberto pelos botoes "Escolher arquivos". */}
        <input
          ref={fileInputRef}
          id="xml-file-input"
          type="file"
          accept=".xml,text/xml,application/xml"
          multiple
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleFileSelect}
        />

        {/* Etapa 1: escolher arquivos */}
        {step === "upload" && (
          <div
            className={cn(
              "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors duration",
              isDragging ? "border-primary bg-primary/5" : "border-border",
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileUp className="h-6 w-6" />
            </span>
            <div className="space-y-1">
              <p className="font-heading text-base font-semibold text-foreground">Arraste os arquivos XML para cá</p>
              <p className="text-sm text-muted-foreground">ou escolha no computador ou celular</p>
            </div>
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload aria-hidden="true" />
              Escolher arquivos
            </Button>
            <p className="text-xs text-muted-foreground">Aceita vários arquivos .xml de uma vez.</p>
          </div>
        )}

        {/* Lendo / salvando */}
        {(step === "processing" || step === "importing") && (
          <div ref={statusRef} tabIndex={-1} className="flex flex-col items-center gap-4 py-10 text-center outline-none" role="status" aria-live="polite">
            <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
            <p className="font-heading text-base font-semibold text-foreground">{progressMessage}</p>
            <div className="w-full max-w-sm space-y-2">
              <Progress value={progress} aria-label="Andamento da importação" />
              <p className="font-data text-sm text-muted-foreground">{Math.round(progress)}%</p>
            </div>
          </div>
        )}

        {/* Etapa 2: conferir */}
        {step === "review" && (
          <div className="min-w-0 space-y-4">
            {importErrorDetails && (
              <details className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <summary className="cursor-pointer font-medium text-foreground">Detalhes técnicos do erro</summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-data text-xs text-muted-foreground">
                  {importErrorDetails}
                </pre>
              </details>
            )}

            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={nonDuplicateCount > 0 ? "success" : "neutral"}>{notesLabel(nonDuplicateCount)} para importar</StatusBadge>
              {duplicateCount > 0 && (
                <StatusBadge tone="neutral">
                  {notesLabel(duplicateCount)} {duplicateCount === 1 ? "já importada" : "já importadas"}
                </StatusBadge>
              )}
              {notGeocodedCount > 0 && <StatusBadge tone="warning">{notesLabel(notGeocodedCount)} sem local no mapa</StatusBadge>}
              {errorCount > 0 && (
                <StatusBadge tone="danger">{errorCount === 1 ? "1 arquivo com erro" : `${errorCount} arquivos com erro`}</StatusBadge>
              )}
            </div>

            {nonDuplicateCount === 0 && processedInvoices.length > 0 && (
              <Alert variant="info">
                <Info aria-hidden="true" />
                <AlertDescription className="text-foreground">
                  Todas as notas destes arquivos já estão no sistema. Escolha outros arquivos ou feche esta janela.
                </AlertDescription>
              </Alert>
            )}

            <div
              ref={reviewRef}
              role="region"
              aria-label="Notas encontradas nos arquivos"
              tabIndex={0}
              className="max-h-[42vh] min-h-[12rem] overflow-y-auto rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  <TableRow>
                    <TableHead className="w-12 pr-0">
                      <Checkbox
                        checked={headerChecked}
                        disabled={nonDuplicateCount === 0}
                        onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                        aria-label="Marcar todas as notas novas"
                        className="flex h-6 w-6 items-center justify-center rounded-[0.375rem] [&_svg]:h-4 [&_svg]:w-4 [&[data-state=indeterminate]_svg]:hidden data-[state=indeterminate]:after:h-0.5 data-[state=indeterminate]:after:w-3 data-[state=indeterminate]:after:rounded-full data-[state=indeterminate]:after:bg-current data-[state=indeterminate]:after:content-['']"
                      />
                    </TableHead>
                    <TableHead className="px-2 sm:px-4">Nota</TableHead>
                    <TableHead className="px-2 sm:px-4">Cliente</TableHead>
                    <TableHead className="hidden px-2 text-right sm:table-cell sm:px-4">Valor</TableHead>
                    <TableHead className="px-2 sm:px-4">Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedInvoices.map((invoice) => (
                    <TableRow key={invoice.id} data-state={invoice.selected ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={invoice.selected}
                          disabled={invoice.isDuplicate}
                          onCheckedChange={() => toggleSelection(invoice.id)}
                          aria-label={invoice.isDuplicate ? `NF ${invoice.nfeNumber} já importada` : `Importar NF ${invoice.nfeNumber}`}
                          className="h-6 w-6 rounded-[0.375rem] [&_svg]:h-4 [&_svg]:w-4"
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-2 font-data font-medium sm:px-4">{invoice.nfeNumber}</TableCell>
                      <TableCell className="w-full max-w-0 px-2 sm:px-4">
                        <p className="truncate text-foreground" title={invoice.recipientName}>
                          {invoice.recipientName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {invoice.addressCity}/{invoice.addressState}
                          <span className="font-data sm:hidden"> · {formatCurrency(invoice.totalValue)}</span>
                        </p>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap px-2 text-right font-data sm:table-cell sm:px-4">
                        {formatCurrency(invoice.totalValue)}
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">
                        <div className="flex flex-col items-start gap-1">
                          {invoice.isDuplicate ? (
                            <StatusBadge tone="neutral">{invoice.duplicateSource === "batch" ? "Repetida" : "Já importada"}</StatusBadge>
                          ) : (
                            <StatusBadge tone="success">Nova</StatusBadge>
                          )}
                          {!invoice.isDuplicate &&
                            (invoice.isGeocoded ? (
                              <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" aria-hidden="true" />
                                No mapa
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-warning" title={invoice.geocodeError}>
                                <MapPinOff className="h-3 w-3" aria-hidden="true" />
                                Sem local no mapa
                              </span>
                            ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {failedParseResults.map((result, index) => (
                    <TableRow key={`error-${result.fileName}-${index}`}>
                      <TableCell>
                        <span className="sr-only">Não pode ser importada</span>
                      </TableCell>
                      <TableCell className="max-w-[8rem] truncate px-2 font-data text-xs sm:px-4" title={result.fileName}>
                        {result.fileName}
                      </TableCell>
                      <TableCell colSpan={2} className="px-2 text-sm text-muted-foreground sm:px-4">
                        {result.error || "Não foi possível ler este XML."}
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">
                        <StatusBadge tone="danger">Erro</StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="sm:items-center">
              <Button variant="ghost" onClick={() => fileInputRef.current?.click()} className="sm:mr-auto">
                <Upload aria-hidden="true" />
                Escolher outros arquivos
              </Button>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={selectedCount === 0}>
                Importar {notesLabel(selectedCount)}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Etapa 3: pronto */}
        {step === "complete" && (
          <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
            <span aria-hidden="true" className="flex h-16 w-16 animate-pop-in items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <p className="font-heading text-lg font-semibold text-foreground">
              {importedCount === 1 ? "1 nota importada" : `${importedCount} notas importadas`}
            </p>
            {duplicateCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {duplicateCount === 1
                  ? "1 nota já existia e ficou de fora."
                  : `${duplicateCount} notas já existiam e ficaram de fora.`}
              </p>
            )}
            <p className="max-w-sm text-sm text-muted-foreground">
              Próximo passo: marque as notas na lista e toque em Gerar romaneio.
            </p>
            <Button ref={doneRef} className="mt-2" onClick={() => handleOpenChange(false)}>
              Ver notas
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
