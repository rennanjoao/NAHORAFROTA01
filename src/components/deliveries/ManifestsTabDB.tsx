import { useState, useMemo, useEffect, useRef } from "react";
import { formatDateOnly, getTodayBrazil, parseDateOnly } from "@/lib/timezone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  MoreHorizontal,
  Printer,
  SearchX,
  Trash2,
  Truck,
} from "lucide-react";
import { ActionMenu, CardsSkeleton, EmptyState, FilterBar, ListSkeleton, SearchInput, StatCard } from "@/components/patterns";
import { useIsMobile } from "@/hooks/use-mobile";
import { useManifestsDB, DBManifest, formatManifestNumber } from "@/hooks/useManifestsDB";
import { ManifestDetailSheet } from "@/components/deliveries/ManifestDetailSheet";
import { ManifestPrintPreview } from "@/components/deliveries/ManifestPrintPreview";
import { DeleteManifestDialog } from "@/components/deliveries/DeleteManifestDialog";
import { formatCurrency } from "@/lib/formatCurrency";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { SegmentedControl } from "@/components/patterns/SegmentedControl";
import { ManifestStatusBadge, plateText, vehicleTypeLabel } from "./status";

type TimeFilter = "daily" | "weekly" | "all";

const PERIOD_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: "daily", label: "Hoje" },
  { value: "weekly", label: "7 dias" },
  { value: "all", label: "Todos" },
];

interface ManifestsTabDBProps {
  /** Termo vindo da busca geral do topo (nonce reaplica o mesmo termo). */
  externalSearch?: { term: string; nonce: number } | null;
  /** Leva para a aba de notas (proximo passo quando nao ha romaneio). */
  onCreateManifest?: () => void;
}

const createdTime = (manifest: DBManifest) =>
  new Date(manifest.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const notesLabel = (count: number) => (count === 1 ? "1 nota" : `${count} notas`);

export function ManifestsTabDB({ externalSearch, onCreateManifest }: ManifestsTabDBProps = {}) {
  const {
    manifests,
    isLoading,
    fetchManifests,
  } = useManifestsDB();
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("daily");

  useEffect(() => {
    if (externalSearch) setSearch(externalSearch.term);
  }, [externalSearch]);

  const [selectedManifest, setSelectedManifest] = useState<DBManifest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const resultRef = useRef<HTMLParagraphElement>(null);

  // "7 dias" = hoje e os 6 dias antes (igual a lista de notas; antes contava 8 dias).
  const { todayStr, weekStartStr } = useMemo(() => {
    const today = getTodayBrazil();
    const start = parseDateOnly(today)!;
    start.setDate(start.getDate() - 6);
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    return { todayStr: today, weekStartStr: startStr };
  }, [manifests]);

  // Filter manifests by time period and search
  const filteredManifests = useMemo(() => {
    return manifests.filter((m) => {
      // Compare date strings directly (YYYY-MM-DD format)
      const manifestDateStr = m.scheduled_date.slice(0, 10);

      // Com busca digitada procura em todos os periodos. Romaneio ainda em aberto
      // (aguardando saida ou em rota) aparece em qualquer periodo, como as notas.
      let timeMatch = true;
      if (search.trim() || m.status === "pending" || m.status === "in_progress") {
        timeMatch = true;
      } else if (timeFilter === "daily") {
        timeMatch = manifestDateStr === todayStr;
      } else if (timeFilter === "weekly") {
        timeMatch = manifestDateStr >= weekStartStr && manifestDateStr <= todayStr;
      }
      // timeFilter === "all" keeps timeMatch = true

      if (!timeMatch) return false;

      if (!search) return true;

      const searchLower = search.toLowerCase();
      return (
        m.manifest_code.toLowerCase().includes(searchLower) ||
        formatManifestNumber(m).includes(search.trim()) ||
        m.driver_name.toLowerCase().includes(searchLower) ||
        (m.driver_cpf && m.driver_cpf.includes(search)) ||
        (m.vehicle_plate && m.vehicle_plate.toLowerCase().includes(searchLower))
      );
    });
  }, [manifests, timeFilter, search, todayStr, weekStartStr]);

  // Stats
  const stats = useMemo(() => {
    const todayManifests = manifests.filter((m) => m.scheduled_date?.slice(0, 10) === todayStr);
    const weekManifests = manifests.filter((m) => {
      const day = m.scheduled_date?.slice(0, 10) || "";
      return day >= weekStartStr && day <= todayStr;
    });

    return {
      today: todayManifests.length,
      todayValue: todayManifests.reduce((sum, m) => sum + (m.total_value || 0), 0),
      week: weekManifests.length,
      weekValue: weekManifests.reduce((sum, m) => sum + (m.total_value || 0), 0),
      completed: filteredManifests.filter((m) => m.status === "completed").length,
      // Em aberto conta todos (nao depende do periodo).
      pending: manifests.filter((m) => m.status === "pending" || m.status === "in_progress").length,
    };
  }, [manifests, filteredManifests, todayStr, weekStartStr]);

  const handleOpenDetail = (manifest: DBManifest) => {
    setSelectedManifest(manifest);
    setIsDetailOpen(true);
  };

  const handlePrint = (manifest: DBManifest) => {
    setSelectedManifest(manifest);
    setIsPrintOpen(true);
  };

  const handleOpenDelete = (manifest: DBManifest) => {
    setSelectedManifest(manifest);
    setIsDeleteOpen(true);
  };

  const handleDelete = async (manifestId: string) => {
    try {
      const { data, error } = await supabase.rpc("delete_manifest", { p_manifest_id: manifestId });
      if (error) throw error;

      const result = data as { success: boolean; error?: string; reopened_count?: number; kept_count?: number } | null;
      if (!result?.success) throw new Error(result?.error || "Não foi possível excluir o romaneio.");

      const reopened = result.reopened_count ?? 0;
      const kept = result.kept_count ?? 0;
      const reopenedText = reopened === 1 ? "1 nota voltou para pendente" : `${reopened} notas voltaram para pendente`;
      const keptText = kept === 1 ? "1 nota já finalizada ficou como estava" : `${kept} notas já finalizadas ficaram como estavam`;
      toast({
        title: "Romaneio excluído",
        description: kept > 0 ? `${reopenedText}; ${keptText}.` : `${reopenedText}.`,
        variant: "success",
      });

      setIsDeleteOpen(false);
      setSelectedManifest(null);
      void fetchManifests();
    } catch (err: any) {
      toast({
        title: "Não foi possível excluir o romaneio",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  // ActionMenu: a janela abre depois que o menu devolve o foco ao "...", entao o foco
  // volta para ele ao fechar. O div segura o clique para nao abrir o detalhe pela linha.
  const renderMenu = (manifest: DBManifest) => {
    const number = formatManifestNumber(manifest);
    return (
      <div onClick={(e) => e.stopPropagation()} className="inline-flex">
        <ActionMenu
          title={`Romaneio ${number}`}
          items={[
            { label: "Ver detalhes", icon: Eye, onSelect: () => handleOpenDetail(manifest) },
            { label: "Imprimir romaneio", icon: Printer, onSelect: () => handlePrint(manifest) },
            { label: "Excluir romaneio", icon: Trash2, destructive: true, separatorBefore: true, onSelect: () => handleOpenDelete(manifest) },
          ]}
          trigger={
            <Button variant="ghost" size="icon" aria-label={`Ações do romaneio ${number}`} className="text-muted-foreground hover:text-foreground">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          }
        />
      </div>
    );
  };

  const numberButton = (manifest: DBManifest, className?: string) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        handleOpenDetail(manifest);
      }}
      aria-label={`Ver romaneio ${formatManifestNumber(manifest)}`}
      className={cn(
        "inline-flex min-h-6 items-center rounded-sm font-data font-semibold text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
        className,
      )}
    >
      Romaneio {formatManifestNumber(manifest)}
    </button>
  );

  // Esqueleto so na primeira carga: recarregar a lista (depois de remover ou finalizar)
  // desmontava a folha de detalhe aberta, que fechava e abria de novo.
  if (isLoading && manifests.length === 0) {
    return (
      <div role="status" aria-label="Carregando romaneios" className="space-y-6">
        <CardsSkeleton count={4} className="grid-cols-2" />
        <ListSkeleton rows={5} />
      </div>
    );
  }

  if (manifests.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nenhum romaneio ainda"
        description="Na aba Notas fiscais, marque as notas que vão sair juntas e toque em Gerar romaneio."
        action={
          onCreateManifest && (
            <Button onClick={onCreateManifest}>
              Escolher notas
            </Button>
          )
        }
      />
    );
  }

  const resultLabel = filteredManifests.length === 1 ? "1 romaneio" : `${filteredManifests.length} romaneios`;

  return (
    <div className="space-y-6">
      {/* Indicadores */}
      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Hoje" value={stats.today} icon={CalendarDays} tone="brand" hint={formatCurrency(stats.todayValue)} />
        <StatCard label="Últimos 7 dias" value={stats.week} icon={CalendarRange} tone="brand" hint={formatCurrency(stats.weekValue)} />
        <StatCard label="Em aberto" value={stats.pending} icon={Clock} tone="info" hint="Aguardando saída ou em rota" />
        <StatCard label="Concluídos" value={stats.completed} icon={CheckCircle2} tone="success" hint="No período escolhido" />
      </div>

      {/* Busca e periodo */}
      <FilterBar>
        <SearchInput
          label="Buscar romaneio"
          placeholder="Número, motorista, CPF ou placa"
          value={search}
          onChange={setSearch}
        />
        <SegmentedControl<TimeFilter> label="Período dos romaneios" options={PERIOD_OPTIONS} value={timeFilter} onChange={(value) => setTimeFilter(value)} />
      </FilterBar>

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p ref={resultRef} tabIndex={-1} className="text-sm text-muted-foreground outline-none" aria-live="polite">
            <span className="font-semibold text-foreground">{resultLabel}</span>
            {search.trim() && " · buscando em todos os períodos"}
          </p>
          {!search.trim() && timeFilter !== "all" && (
            <p className="text-xs text-muted-foreground">Romaneios em aberto aparecem em qualquer período.</p>
          )}
        </div>

        {filteredManifests.length === 0 ? (
          <Card>
            <EmptyState
              compact
              icon={SearchX}
              title={search.trim() ? "Nenhum romaneio encontrado" : "Nenhum romaneio neste período"}
              description={search.trim() ? "Confira o número, o nome do motorista ou a placa." : "Veja todos os romaneios ou escolha outro período."}
              action={
                search.trim() ? (
                  <Button variant="outline" onClick={() => setSearch("")}>
                    Limpar busca
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setTimeFilter("all")}>
                    Ver todos os romaneios
                  </Button>
                )
              }
            />
          </Card>
        ) : isMobile ? (
          <ul className="space-y-3" aria-label="Romaneios">
            {filteredManifests.map((manifest) => (
              <li key={manifest.id} className="rounded-lg border bg-card p-4 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-h-10 flex-col justify-center">
                      {numberButton(manifest, "self-start text-base")}
                      <span className="text-xs text-muted-foreground">
                        {formatDateOnly(manifest.scheduled_date)} às {createdTime(manifest)}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-medium text-foreground">{manifest.driver_name}</p>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {vehicleTypeLabel(manifest.vehicle_type)} · {plateText(manifest.vehicle_plate) || "sem placa"}
                      </span>
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <ManifestStatusBadge status={manifest.status} />
                      <span className="text-sm">
                        <span className="text-muted-foreground">{notesLabel(manifest.deliveries_count)} · </span>
                        <span className="font-data font-semibold">{formatCurrency(manifest.total_value || 0)}</span>
                      </span>
                    </div>
                  </div>
                  <div className="-mr-2 -mt-1 shrink-0">{renderMenu(manifest)}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Romaneio</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead className="hidden xl:table-cell">Veículo</TableHead>
                  <TableHead className="text-right">Notas</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Valor</TableHead>
                  <TableHead className="hidden lg:table-cell">Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16 pr-5 text-right">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredManifests.map((manifest) => (
                  // Clique na linha tambem abre o detalhe (atalho do mouse; o botao do numero e o acesso principal).
                  <TableRow key={manifest.id} className="h-[4.25rem] cursor-pointer" onClick={() => handleOpenDetail(manifest)}>
                    <TableCell className="whitespace-nowrap pl-5">
                      <div className="flex flex-col items-start">
                        {numberButton(manifest)}
                        <span className="font-data text-xs text-muted-foreground">{manifest.manifest_code}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-0 w-full">
                      <p className="truncate font-medium text-foreground">{manifest.driver_name}</p>
                      {manifest.driver_cpf && <p className="font-data text-xs text-muted-foreground">{manifest.driver_cpf}</p>}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap xl:table-cell">
                      <p>{vehicleTypeLabel(manifest.vehicle_type)}</p>
                      <p className="font-data text-xs text-muted-foreground">{plateText(manifest.vehicle_plate) || "Sem placa"}</p>
                    </TableCell>
                    <TableCell className="text-right font-data">{manifest.deliveries_count}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-right font-data font-medium lg:table-cell">
                      {formatCurrency(manifest.total_value || 0)}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap lg:table-cell">
                      <p className="font-data">{formatDateOnly(manifest.scheduled_date)}</p>
                      <p className="font-data text-xs text-muted-foreground">{createdTime(manifest)}</p>
                    </TableCell>
                    <TableCell>
                      <ManifestStatusBadge status={manifest.status} />
                    </TableCell>
                    <TableCell className="pr-3 text-right">{renderMenu(manifest)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Detail Sheet */}
      <ManifestDetailSheet
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        manifest={selectedManifest}
        onRefresh={fetchManifests}
      />

      {/* Print Preview */}
      <ManifestPrintPreview
        open={isPrintOpen}
        onOpenChange={setIsPrintOpen}
        manifest={null}
        deliveries={[]}
        dbManifest={selectedManifest}
      />

      {/* Delete Dialog */}
      <DeleteManifestDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        manifest={
          selectedManifest
            ? {
                id: selectedManifest.manifest_code,
                driverId: 0,
                driverName: selectedManifest.driver_name,
                driverCpf: selectedManifest.driver_cpf || "",
                driverPlate: selectedManifest.vehicle_plate || "",
                vehicleType: selectedManifest.vehicle_type || "",
                isOwnVehicle: selectedManifest.is_own_fleet,
                freightType: selectedManifest.freight_type as
                  | "fixed"
                  | "lumpsum"
                  | "per_km",
                calculatedTotal: selectedManifest.freight_value,
                deliveriesCount: selectedManifest.deliveries_count,
                deliveryIds: [],
                createdAt: new Date(selectedManifest.created_at),
                status: selectedManifest.status as "pending" | "paid",
              }
            : null
        }
        displayNumber={selectedManifest ? formatManifestNumber(selectedManifest) : undefined}
        focusFallback={() => resultRef.current}
        onConfirm={() => (selectedManifest ? handleDelete(selectedManifest.id) : undefined)}
        canDelete={
          selectedManifest?.status !== "completed" &&
          selectedManifest?.status !== "paid"
        }
        hardBlocked={selectedManifest?.status === "paid"}
        blockReason={
          selectedManifest?.status === "paid"
            ? "Romaneio pago não pode ser excluído. Estorne o pagamento no Acerto antes."
            : selectedManifest?.status === "completed"
              ? "Romaneios finalizados só podem ser excluídos com a senha de supervisor."
              : undefined
        }
      />
    </div>
  );
}
