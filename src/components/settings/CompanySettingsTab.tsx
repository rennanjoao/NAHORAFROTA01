import { useState, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { Building2, Loader2, Lock, MapPin, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/patterns";
import { toast } from "@/hooks/use-toast";
import { formatCNPJ, validateCNPJ, formatPhone, formatCEP } from "@/lib/cnpjValidation";
import { supabase } from "@/integrations/supabase/client";
import { useTenantData } from "@/hooks/useTenantData";
import { useAuth } from "@/contexts/AuthContext";
import { FormField } from "@/components/patterns/FormField";
import { SettingsCard } from "./SettingsCard";

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const readOnlyClass = "bg-muted/50 text-muted-foreground hover:border-input focus-visible:border-input";

/** Coordenada em pt-BR (virgula decimal). */
const formatCoord = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 6, maximumFractionDigits: 6 });

function FormGroup({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="space-y-4 border-t pt-6 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function CompanySettingsTab() {
  const { tenant, isLoading: tenantLoading, updateTenant } = useTenantData();
  // Somente o Administrador altera os dados da empresa (regra tambem no banco).
  const { isAdmin } = useAuth();
  const canEdit = isAdmin();
  const razaoRef = useRef<HTMLInputElement>(null);

  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [cep, setCep] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [cnpjValid, setCnpjValid] = useState<boolean | null>(null);
  const [razaoError, setRazaoError] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Preenche o formulario quando a empresa carrega
  useEffect(() => {
    if (tenant) {
      setRazaoSocial(tenant.razao_social || "");
      setCnpj(formatCNPJ(tenant.cnpj || ""));
      setTelefone(tenant.telefone || "");
      setLogradouro(tenant.logradouro || "");
      setNumero(tenant.numero || "");
      setBairro(tenant.bairro || "");
      setCidade(tenant.cidade || "");
      setUf(tenant.uf || "");
      setCep(tenant.cep || "");
      setLatitude(tenant.latitude);
      setLongitude(tenant.longitude);
    }
  }, [tenant]);

  useEffect(() => {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length === 14) {
      setCnpjValid(validateCNPJ(cnpj));
    } else {
      setCnpjValid(null);
    }
  }, [cnpj]);

  const handleGeocode = async () => {
    const fullAddress = `${logradouro}, ${numero} - ${bairro}, ${cidade} - ${uf}, ${cep}`;
    if (!logradouro || !cidade || !uf) {
      toast({
        title: "Endereço incompleto",
        description: "Preencha rua, cidade e estado para buscar a localização.",
        variant: "destructive",
      });
      return;
    }
    setIsGeocoding(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast({ title: "Sessão expirada", description: "Entre de novo para continuar.", variant: "destructive" });
        setIsGeocoding(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('geocode-address', {
        headers: { Authorization: `Bearer ${token}` },
        body: { address: fullAddress },
      });

      if (error || !data?.success) {
        toast({
          title: "Não foi possível achar o endereço no mapa",
          description: "Confira rua, número, cidade e estado e tente de novo.",
          variant: "destructive",
        });
      } else {
        setLatitude(data.latitude);
        setLongitude(data.longitude);
        toast({
          title: "Localização encontrada",
          description: `Latitude ${formatCoord(data.latitude)}, longitude ${formatCoord(data.longitude)}. Salve para usar nas rotas.`,
          variant: "success",
        });
      }
    } catch {
      toast({
        title: "Não foi possível achar o endereço no mapa",
        description: "Confira o endereço e tente de novo.",
        variant: "destructive",
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!razaoSocial.trim()) {
      setRazaoError("Digite a razão social da empresa.");
      razaoRef.current?.focus();
      return;
    }
    setIsSaving(true);
    await updateTenant({
      razao_social: razaoSocial,
      telefone,
      logradouro: logradouro || null,
      numero: numero || null,
      bairro: bairro || null,
      cidade: cidade || null,
      uf: uf || null,
      cep: cep || null,
      latitude,
      longitude,
    });
    setIsSaving(false);
  };

  if (tenantLoading) {
    return (
      <div role="status" aria-label="Carregando dados da empresa" className="space-y-5 rounded-lg border bg-card p-6 shadow-sm">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <span className="sr-only">Carregando dados da empresa</span>
      </div>
    );
  }

  const hasLocation = !!latitude && !!longitude;
  // So leitura: campo vazio diz "Nao informado" (o exemplo "123" parecia um dado).
  const hint = (example: string) => (canEdit ? example : "Não informado");

  return (
    <SettingsCard
      icon={Building2}
      title="Dados da empresa"
      description="Cadastro da empresa e o endereço de onde saem as entregas."
      onSubmit={canEdit ? handleSave : (event) => event.preventDefault()}
      footerHint={canEdit ? "O endereço da base é o ponto de partida de todas as rotas." : undefined}
      footer={
        canEdit ? (
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
            {isSaving ? "Salvando..." : "Salvar dados da empresa"}
          </Button>
        ) : undefined
      }
    >
      {!canEdit && (
        <Alert variant="info" className="mb-6">
          <Lock aria-hidden="true" />
          <AlertDescription className="text-foreground">
            Você pode ver os dados, mas somente o administrador da conta pode alterá-los.
          </AlertDescription>
        </Alert>
      )}

      <fieldset disabled={!canEdit} className="min-w-0 space-y-6">

        <FormGroup title="Cadastro">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField id="razaoSocial" label="Razão social" error={razaoError} className="sm:col-span-2">
              {(control) => (
                <Input
                  {...control}
                  ref={razaoRef}
                  value={razaoSocial}
                  aria-required="true"
                  onChange={(e) => {
                    setRazaoSocial(e.target.value);
                    if (razaoError) setRazaoError(null);
                  }}
                  placeholder={hint("Nome empresarial completo")}
                />
              )}
            </FormField>
            <FormField id="cnpj" label="CNPJ" hint="O CNPJ não pode ser alterado.">
              {(control) => (
                <div className="flex items-center gap-2">
                  <Input {...control} value={cnpj} readOnly className={readOnlyClass} />
                  {cnpjValid !== null && (
                    <StatusBadge tone={cnpjValid ? "success" : "danger"} className="shrink-0">
                      {cnpjValid ? "Válido" : "Inválido"}
                    </StatusBadge>
                  )}
                </div>
              )}
            </FormField>
            <FormField id="telefone" label="Telefone" optional>
              {(control) => (
                <Input
                  {...control}
                  type="tel"
                  inputMode="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(formatPhone(e.target.value))}
                  placeholder={hint("(00) 00000-0000")}
                />
              )}
            </FormField>
          </div>
        </FormGroup>

        <FormGroup title="Endereço da base" description="De onde os motoristas saem para as entregas.">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-6">
            <FormField id="logradouro" label="Rua ou avenida" className="sm:col-span-4">
              {(control) => (
                <Input {...control} value={logradouro} onChange={(e) => setLogradouro(e.target.value)} placeholder={hint("Ex.: Rua das Flores")} />
              )}
            </FormField>
            <FormField id="numero" label="Número" className="sm:col-span-2">
              {(control) => (
                <Input {...control} inputMode="numeric" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder={hint("123")} />
              )}
            </FormField>
            <FormField id="bairro" label="Bairro" className="sm:col-span-2">
              {(control) => <Input {...control} value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder={hint("")} />}
            </FormField>
            <FormField id="cidade" label="Cidade" className="sm:col-span-2">
              {(control) => <Input {...control} value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder={hint("")} />}
            </FormField>
            <div className="grid grid-cols-2 gap-5 sm:col-span-2">
              <FormField id="uf" label="Estado">
                {(control) => (
                  <Select value={uf} onValueChange={setUf} disabled={!canEdit}>
                    <SelectTrigger {...control}>
                      <SelectValue placeholder={canEdit ? "UF" : "—"} />
                    </SelectTrigger>
                    <SelectContent>
                      {UF_OPTIONS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              <FormField id="cep" label="CEP">
                {(control) => (
                  <Input
                    {...control}
                    inputMode="numeric"
                    value={cep}
                    onChange={(e) => setCep(formatCEP(e.target.value))}
                    placeholder={hint("00000-000")}
                  />
                )}
              </FormField>
            </div>
          </div>
        </FormGroup>

        <FormGroup title="Localização no mapa" description="Com a localização, o sistema calcula as rotas a partir da base.">
          <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-xs"
              >
                <MapPin className="h-5 w-5" />
              </span>
              <div className="min-w-0 space-y-1">
                <StatusBadge tone={hasLocation ? "success" : "warning"}>
                  {hasLocation ? "Localização definida" : "Sem localização"}
                </StatusBadge>
                {hasLocation ? (
                  <p className="font-data text-sm text-muted-foreground">
                    <span className="sr-only">Latitude </span>
                    {formatCoord(latitude as number)}
                    <span aria-hidden="true"> · </span>
                    <span className="sr-only">, longitude </span>
                    {formatCoord(longitude as number)}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {canEdit
                      ? "Preencha o endereço e use “Buscar no mapa”."
                      : "O administrador ainda não marcou a base no mapa."}
                  </p>
                )}
              </div>
            </div>
            {canEdit && (
              <Button type="button" variant="outline" onClick={handleGeocode} disabled={isGeocoding} className="shrink-0">
                {isGeocoding ? <Loader2 className="animate-spin" aria-hidden="true" /> : <MapPin aria-hidden="true" />}
                {isGeocoding ? "Buscando..." : hasLocation ? "Buscar de novo" : "Buscar no mapa"}
              </Button>
            )}
          </div>
        </FormGroup>
      </fieldset>
    </SettingsCard>
  );
}
