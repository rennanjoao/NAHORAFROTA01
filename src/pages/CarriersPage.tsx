import { useMemo, useRef, useState } from "react";
import { Building2, Landmark, MoreHorizontal, Pencil, Plus, Trash2, Users, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionMenu } from "@/components/patterns/ActionMenu";
import { ConfirmDialog, EmptyState, ListSkeleton, PageHeader, SearchInput, StatusBadge } from "@/components/patterns";
import { CarrierDialog } from "@/components/carriers/CarrierDialog";
import { PixCopyButton } from "@/components/settlement/PixCopyButton";
import { toast } from "@/hooks/use-toast";
import { useQueryAction } from "@/hooks/useQueryAction";
import { useCarriers, carrierName, type Carrier } from "@/hooks/useCarriers";
import { useDBDrivers } from "@/hooks/useDBDrivers";
import { supabase } from "@/integrations/supabase/client";
import { formatCNPJ } from "@/lib/cnpjValidation";

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Frota > Transportadoras: parceiras que recebem pelos motoristas ligados a elas
 * (o acerto sai para a transportadora; a regra da nota fiscal so vale para o TAC).
 */
export default function CarriersPage() {
  const { carriers, isLoading, refresh } = useCarriers();
  const { drivers } = useDBDrivers();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Carrier | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [removing, setRemoving] = useState<Carrier | null>(null);
  const [busy, setBusy] = useState(false);
  const newButtonRef = useRef<HTMLButtonElement>(null);

  const driversByCarrier = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const driver of drivers as { carrier_id?: string | null; name: string }[]) {
      if (!driver.carrier_id) continue;
      map.set(driver.carrier_id, [...(map.get(driver.carrier_id) ?? []), driver.name]);
    }
    return map;
  }, [drivers]);

  const filtered = useMemo(() => {
    const term = fold(search.trim());
    const digits = search.replace(/\D/g, "");
    if (!term) return carriers;
    return carriers.filter((c) => fold(`${c.razao_social} ${c.nome_fantasia ?? ""} ${c.cidade ?? ""}`).includes(term) || (digits && c.cnpj.includes(digits)));
  }, [carriers, search]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  useQueryAction("new", () => {
    newButtonRef.current?.focus();
    openNew();
  });

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    const { error } = await supabase.from("carriers").delete().eq("id", removing.id);
    setBusy(false);
    if (error) {
      toast({ title: "Não foi possível excluir", description: "Confira a internet e tente de novo.", variant: "destructive" });
      return;
    }
    toast({ title: "Transportadora excluída", description: "Os motoristas dela passam a receber direto (TAC)." });
    setRemoving(null);
    void refresh();
  };

  return (
    <>
      <PageHeader
        icon={Warehouse}
        title="Transportadoras"
        description="Parceiras que recebem pelos motoristas ligados a elas. O acerto desses motoristas sai para a transportadora, sem exigir nota fiscal no app."
        actions={
          <Button ref={newButtonRef} onClick={openNew}>
            <Plus aria-hidden="true" />
            Cadastrar transportadora
          </Button>
        }
      />

      <div className="space-y-6">
        {carriers.length > 3 && <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, CNPJ ou cidade" label="Buscar transportadora" />}

        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title={carriers.length === 0 ? "Nenhuma transportadora cadastrada" : "Nenhuma transportadora encontrada"}
            description={
              carriers.length === 0
                ? "Cadastre as transportadoras parceiras. Depois, no cadastro do motorista, escolha a transportadora dele."
                : "Confira o nome ou o CNPJ digitado."
            }
            action={
              carriers.length === 0 ? (
                <Button onClick={openNew}>
                  <Plus aria-hidden="true" />
                  Cadastrar transportadora
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((carrier) => {
              const people = driversByCarrier.get(carrier.id) ?? [];
              return (
                <li key={carrier.id} className="card-interactive relative flex flex-col gap-4 rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-info/15 text-info">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="leading-tight">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(carrier);
                            setFormOpen(true);
                          }}
                          className="text-left font-semibold text-foreground after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:text-primary focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                        >
                          <span className="sr-only">Editar </span>
                          {carrierName(carrier)}
                        </button>
                      </h2>
                      {carrier.nome_fantasia && <p className="truncate text-sm text-muted-foreground">{carrier.razao_social}</p>}
                    </div>
                    <div className="relative z-10 -mr-2 -mt-1.5">
                      <ActionMenu
                        title={carrierName(carrier)}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Ações da transportadora ${carrierName(carrier)}`}>
                            <MoreHorizontal aria-hidden="true" />
                          </Button>
                        }
                        items={[
                          { label: "Editar dados", icon: Pencil, onSelect: () => { setEditing(carrier); setFormOpen(true); } },
                          { label: "Excluir transportadora", icon: Trash2, onSelect: () => setRemoving(carrier), destructive: true, separatorBefore: true },
                        ]}
                      />
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">CNPJ</dt>
                      <dd className="font-data text-foreground">{formatCNPJ(carrier.cnpj)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Inscrição estadual</dt>
                      <dd className="font-data text-foreground">{carrier.ie_isento ? "Isenta" : carrier.inscricao_estadual || "—"}</dd>
                    </div>
                    {(carrier.cidade || carrier.uf) && (
                      <div className="col-span-2">
                        <dt className="text-xs text-muted-foreground">Cidade</dt>
                        <dd className="text-foreground">{[carrier.cidade, carrier.uf].filter(Boolean).join("/")}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="relative z-10 mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
                    <StatusBadge tone={people.length ? "info" : "neutral"}>
                      <Users className="h-3 w-3" aria-hidden="true" />
                      {people.length === 0 ? "Sem motoristas" : `${people.length} motorista${people.length === 1 ? "" : "s"}`}
                    </StatusBadge>
                    {carrier.chave_pix ? (
                      <PixCopyButton pixKey={carrier.chave_pix} />
                    ) : (
                      <StatusBadge tone="warning">
                        <Landmark className="h-3 w-3" aria-hidden="true" />
                        Sem Pix
                      </StatusBadge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <CarrierDialog open={formOpen} onOpenChange={setFormOpen} carrier={editing} onSaved={() => void refresh()} />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Excluir ${carrierName(removing)}?`}
        description="Os motoristas ligados a ela continuam cadastrados e passam a receber direto (TAC)."
        confirmLabel="Excluir transportadora"
        tone="danger"
        loading={busy}
        onConfirm={() => void remove()}
      />
    </>
  );
}
