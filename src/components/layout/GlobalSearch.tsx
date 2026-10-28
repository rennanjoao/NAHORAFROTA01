import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, FileText, Loader2, Search, Truck, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ResultKind = "driver" | "vehicle" | "invoice" | "manifest";

interface SearchResult {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const KIND_META: Record<ResultKind, { label: string; icon: typeof User }> = {
  driver: { label: "Motoristas", icon: User },
  vehicle: { label: "Veículos", icon: Truck },
  invoice: { label: "Notas Fiscais", icon: FileText },
  manifest: { label: "Romaneios", icon: ClipboardList },
};

const LIMIT = 5;

/** Remove o que tem significado no filtro "or" do PostgREST (virgula, parenteses, curingas). */
function toFilterTerm(value: string): string {
  return value.replace(/[,()*%\\:"]/g, " ").replace(/\s+/g, " ").trim();
}

async function searchAll(term: string): Promise<SearchResult[]> {
  // Valor entre aspas: pontos e espacos do termo nao quebram o filtro.
  const like = `"%${term}%"`;
  const digits = term.replace(/\D/g, "");
  const q = encodeURIComponent;

  const driverFilter = [`name.ilike.${like}`, `vehicle_plate.ilike.${like}`];
  if (digits.length >= 3) driverFilter.push(`cpf.ilike."%${digits}%"`);

  // O RLS ja limita tudo a empresa do usuario.
  const [drivers, vehicles, invoices, manifests] = await Promise.all([
    supabase.from("drivers").select("id, name, vehicle_plate, vehicle_type").or(driverFilter.join(",")).limit(LIMIT),
    supabase.from("company_vehicles").select("id, plate, brand, model").or(`plate.ilike.${like},model.ilike.${like},brand.ilike.${like}`).limit(LIMIT),
    supabase
      .from("invoices")
      .select("id, nfe_number, recipient_name, address_city")
      .or(`nfe_number.ilike.${like},recipient_name.ilike.${like},access_key.ilike.${like}`)
      .order("imported_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("manifests")
      .select("id, manifest_code, driver_name, scheduled_date")
      .or(`manifest_code.ilike.${like},driver_name.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
  ]);

  const results: SearchResult[] = [];
  for (const d of drivers.data || []) {
    results.push({
      kind: "driver",
      id: d.id,
      title: d.name,
      subtitle: [d.vehicle_type, d.vehicle_plate].filter(Boolean).join(" • "),
      href: `/drivers?q=${q(d.name)}`,
    });
  }
  for (const v of vehicles.data || []) {
    results.push({
      kind: "vehicle",
      id: v.id,
      title: v.plate,
      subtitle: [v.brand, v.model].filter(Boolean).join(" "),
      href: `/vehicles?q=${q(v.plate)}`,
    });
  }
  for (const i of invoices.data || []) {
    const number = i.nfe_number || "";
    results.push({
      kind: "invoice",
      id: i.id,
      title: number ? `NF ${number}` : i.recipient_name || "Nota fiscal",
      subtitle: [i.recipient_name, i.address_city].filter(Boolean).join(" • "),
      href: `/deliveries?q=${q(number || i.recipient_name || term)}`,
    });
  }
  for (const m of manifests.data || []) {
    results.push({
      kind: "manifest",
      id: m.id,
      title: m.manifest_code,
      subtitle: m.driver_name || "",
      href: `/deliveries?tab=romaneios&q=${q(m.manifest_code)}`,
    });
  }
  return results;
}

interface GlobalSearchProps {
  className?: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
}

export function GlobalSearch({ className, autoFocus, onNavigate }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const requestRef = useRef(0);

  const term = toFilterTerm(value);

  useEffect(() => {
    if (term.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const request = ++requestRef.current;
    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const found = await searchAll(term);
        if (request === requestRef.current) {
          setResults(found);
          setActiveIndex(0);
        }
      } catch (error) {
        console.error("Global search error:", error);
        if (request === requestRef.current) setResults([]);
      } finally {
        if (request === requestRef.current) setIsSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [term]);

  const go = (result: SearchResult) => {
    setOpen(false);
    setValue("");
    navigate(result.href);
    onNavigate?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[activeIndex] ?? results[0]);
    }
  };

  const showPanel = open && term.length >= 2;
  const grouped = (Object.keys(KIND_META) as ResultKind[])
    .map((kind) => ({ kind, items: results.filter((r) => r.kind === kind) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar motorista, veículo, NF, romaneio..."
        className="w-full bg-secondary border-0 pl-10"
        aria-label="Busca geral"
        role="combobox"
        aria-expanded={showPanel}
      />

      {showPanel && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
          // Evita que o blur do campo feche a lista antes do clique.
          onMouseDown={(e) => e.preventDefault()}
        >
          {isSearching && results.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando...
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">Nada encontrado para "{term}".</div>
          ) : (
            grouped.map(({ kind, items }) => {
              const { label, icon: Icon } = KIND_META[kind];
              return (
                <div key={kind} className="py-1">
                  <p className="px-3 py-1 text-xs font-medium text-muted-foreground">{label}</p>
                  {items.map((item) => {
                    const index = results.indexOf(item);
                    return (
                      <button
                        key={`${item.kind}-${item.id}`}
                        type="button"
                        onClick={() => go(item)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm",
                          index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{item.title}</span>
                          {item.subtitle && (
                            <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
