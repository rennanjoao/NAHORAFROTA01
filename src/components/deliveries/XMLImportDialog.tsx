import { useState, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FileWarning,
  MapPin,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { parseMultipleXmls, ParseResult, ParsedNFeData } from "@/lib/nfeXmlParser";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { calculateRegiaoLogistica } from "@/lib/cepRegionMapping";
import { requireCurrentTenantId } from "@/lib/tenant";

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

  // Reset state when dialog closes
  const handleOpenChange = (open: boolean) => {
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
        description: "Por favor, selecione arquivos .xml válidos.",
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

    if (selectedFiles.length === 0) {
      toast({
        title: "Nenhum arquivo XML",
        description: "Por favor, selecione arquivos .xml válidos.",
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
    setProgressMessage("Lendo arquivos XML...");

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
        const errorDetails = failedResults.length > 0 
          ? `Erros: ${failedResults.map(f => f.error).join("; ")}`
          : "Não foi possível processar nenhum arquivo XML.";
        toast({
          title: "Nenhuma NF-e válida",
          description: errorDetails,
          variant: "destructive",
        });
        setStep("upload");
        return;
      }

      setProgressMessage("Verificando duplicidades...");
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

      setProgressMessage("Geocodificando endereços...");

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
        title: "Erro no processamento",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao processar os arquivos.",
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
        title: "Nenhuma NF selecionada",
        description: "Selecione pelo menos uma NF para importar.",
        variant: "destructive",
      });
      return;
    }

    setStep("importing");
    setProgress(0);
    setProgressMessage("Salvando notas fiscais...");

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
        title: "✅ Importação concluída",
        description:
          skippedNow > 0
            ? `${importedNow} nota(s) importada(s) e ${skippedNow} ignorada(s) por duplicidade.`
            : `${importedNow} nota(s) fiscal(is) importada(s) com sucesso.`,
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
        title: "Erro na importação",
        description: `${anyErr?.message || "Não foi possível salvar as notas fiscais."}${anyErr?.code ? ` (código: ${anyErr.code})` : ""}`,
        variant: "destructive",
      });
      setStep("review");
    }
  };

  const selectedCount = processedInvoices.filter((inv) => inv.selected && !inv.isDuplicate).length;
  const nonDuplicateCount = processedInvoices.filter((inv) => !inv.isDuplicate).length;
  const failedParseResults = parseResults.filter((result) => !result.success);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Notas Fiscais (XML)
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Arraste e solte arquivos XML de NF-e ou clique para selecionar."}
            {step === "processing" && "Processando arquivos..."}
            {step === "review" && "Revise as notas antes de confirmar a importação."}
            {step === "importing" && "Salvando notas fiscais..."}
            {step === "complete" && "Importação concluída!"}
          </DialogDescription>
        </DialogHeader>

        {/* Upload Step */}
        {step === "upload" && (
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById("xml-file-input")?.click()}
          >
            <input
              id="xml-file-input"
              type="file"
              accept=".xml"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Arraste arquivos XML aqui</h3>
            <p className="text-sm text-muted-foreground mb-4">
              ou clique para selecionar arquivos
            </p>
            <Badge variant="outline">Aceita múltiplos arquivos</Badge>
          </div>
        )}

        {/* Processing Step */}
        {step === "processing" && (
          <div className="py-12 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
            <h3 className="text-lg font-medium mb-2">{progressMessage}</h3>
            <Progress value={progress} className="w-full max-w-md mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">{Math.round(progress)}%</p>
          </div>
        )}

        {/* Review Step */}
        {step === "review" && (
          <div className="flex min-h-0 flex-1 flex-col">
            {importErrorDetails && (
              <div className="mb-4 shrink-0 rounded-md border p-3 text-sm">
                <p className="font-medium">Detalhes do erro (para debug)</p>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
                  {importErrorDetails}
                </pre>
              </div>
            )}

            {/* Summary badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {nonDuplicateCount} válida(s)
              </Badge>
              {duplicateCount > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {duplicateCount} duplicada(s)
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {errorCount} com erro
                </Badge>
              )}
            </div>

            {/* Review table */}
            <ScrollArea className="h-[280px] max-h-[42vh] min-h-[220px] rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedCount === nonDuplicateCount && nonDuplicateCount > 0}
                        onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                      />
                    </TableHead>
                    <TableHead>NF-e</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Geo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedInvoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className={cn(
                        invoice.isDuplicate && "opacity-50 bg-muted/30"
                      )}
                    >
                      <TableCell>
                        <Checkbox
                          checked={invoice.selected}
                          disabled={invoice.isDuplicate}
                          onCheckedChange={() => toggleSelection(invoice.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {invoice.nfeNumber}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {invoice.recipientName}
                      </TableCell>
                      <TableCell>
                        {invoice.addressCity}/{invoice.addressState}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.totalValue)}
                      </TableCell>
                      <TableCell className="text-center">
                        {invoice.isDuplicate ? (
                          <span className="text-muted-foreground">—</span>
                        ) : invoice.isGeocoded ? (
                          <MapPin className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <FileWarning className="h-4 w-4 text-yellow-500 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell>
                        {invoice.isDuplicate ? (
                          <Badge variant="secondary">
                            {invoice.duplicateSource === "batch" ? "Duplicada no lote" : "Duplicada"}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Nova</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {failedParseResults.map((result, index) => (
                    <TableRow key={`error-${result.fileName}-${index}`} className="bg-destructive/5">
                      <TableCell>
                        <Checkbox checked={false} disabled />
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate font-mono text-xs">
                        {result.fileName}
                      </TableCell>
                      <TableCell colSpan={4} className="text-sm text-muted-foreground">
                        {result.error || "NÃ£o foi possÃ­vel processar este XML."}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">Erro</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <DialogFooter className="mt-4 shrink-0">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={selectedCount === 0}>
                Importar {selectedCount} NF(s)
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Importing Step */}
        {step === "importing" && (
          <div className="py-12 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
            <h3 className="text-lg font-medium mb-2">{progressMessage}</h3>
            <Progress value={progress} className="w-full max-w-md mx-auto" />
          </div>
        )}

        {/* Complete Step */}
        {step === "complete" && (
          <div className="py-12 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h3 className="text-xl font-medium mb-2">Importação Concluída!</h3>
            <div className="flex justify-center gap-4 mb-6">
              <Badge variant="default" className="text-base px-4 py-2">
                {importedCount} importada(s)
              </Badge>
              {duplicateCount > 0 && (
                <Badge variant="secondary" className="text-base px-4 py-2">
                  {duplicateCount} ignorada(s) por duplicidade
                </Badge>
              )}
            </div>
            <Button onClick={() => handleOpenChange(false)}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
