import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useTenantData } from "@/hooks/useTenantData";
import { useAuth } from "@/contexts/AuthContext";
import { ACCEPTED_IMAGES, saveCompanyLogo } from "@/lib/tenantMedia";
import { useQueryClient } from "@tanstack/react-query";
import { SettingsCard } from "@/components/settings/SettingsCard";

const LOGO_HINT = "PNG com fundo transparente fica melhor. JPG ou WebP também servem.";

function LogoPreview({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="flex h-20 w-44 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white p-2">
      {src ? (
        <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
      ) : (
        <span className="text-center text-xs text-neutral-500">Sem logo</span>
      )}
    </div>
  );
}

/**
 * Logo escolhido no cadastro, antes de a empresa existir: fica so no aparelho e e
 * enviado logo depois do primeiro login (RegisterPage / PrimeiroAcessoPage).
 */
export function LogoChooser({ file, onChange, disabled }: { file: File | null; onChange: (file: File | null) => void; disabled?: boolean }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (chosen && !chosen.type.startsWith("image/")) {
      toast({ title: "Escolha uma imagem", description: LOGO_HINT, variant: "destructive" });
      return;
    }
    onChange(chosen);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-medium text-foreground">
          Logo da empresa
        </span>
        <span className="text-xs text-muted-foreground">Opcional</span>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <LogoPreview src={preview} alt="Logo escolhido" />
        <div className="space-y-2" role="group" aria-labelledby={`${id}-label`}>
          <input ref={inputRef} type="file" accept={ACCEPTED_IMAGES} onChange={pick} className="hidden" tabIndex={-1} aria-hidden="true" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
              <ImageUp aria-hidden="true" />
              {file ? "Trocar logo" : "Escolher logo"}
            </Button>
            {file && (
              <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(null)}>
                <Trash2 aria-hidden="true" />
                Tirar
              </Button>
            )}
          </div>
          <p className="max-w-xs text-xs text-muted-foreground">Sai no romaneio impresso. Dá para trocar depois em Configurações.</p>
        </div>
      </div>
    </div>
  );
}

/** Configuracoes > Dados da empresa: logo que sai no romaneio impresso. */
export function CompanyLogoCard() {
  const { tenant } = useTenantData();
  const { isAdmin } = useAuth();
  const canEdit = isAdmin();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const current = tenant?.logo_url ?? null;

  const save = async (file: File | null) => {
    setBusy(true);
    try {
      const url = await saveCompanyLogo(file, current);
      queryClient.setQueriesData<{ logo_url: string | null } | null>({ queryKey: ["tenant-data"] }, (prev) => (prev ? { ...prev, logo_url: url } : prev));
      toast({ title: url ? "Logo salvo" : "Logo removido", description: url ? "Os próximos romaneios já saem com ele." : "O romaneio volta a sair com o logo do Na Hora Frota." });
    } catch (error) {
      toast({ title: "Não foi possível salvar o logo", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void save(file);
  };

  return (
    <SettingsCard
      icon={ImageUp}
      title="Logo da empresa"
      description="Sai no topo do romaneio impresso. Sem logo, o romaneio usa o do Na Hora Frota."
      footerHint={LOGO_HINT}
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative">
          <LogoPreview src={current} alt={`Logo de ${tenant?.razao_social || "sua empresa"}`} />
          {busy && (
            <div role="status" className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <span className="sr-only">Salvando logo</span>
            </div>
          )}
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <input ref={inputRef} type="file" accept={ACCEPTED_IMAGES} onChange={pick} className="hidden" tabIndex={-1} aria-hidden="true" />
            <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
              <ImageUp aria-hidden="true" />
              {current ? "Trocar logo" : "Enviar logo"}
            </Button>
            {current && (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => void save(null)} className="text-destructive hover:text-destructive">
                <Trash2 aria-hidden="true" />
                Remover
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Só o administrador da conta troca o logo.</p>
        )}
      </div>
    </SettingsCard>
  );
}
