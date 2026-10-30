import { useEffect, useState, type FormEvent } from "react";
import { Building2, Landmark, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormField } from "@/components/patterns/FormField";
import { BankFields, type BankValues } from "@/components/drivers/DriverFormParts";
import { TabErrorDot } from "@/components/drivers/TabErrorDot";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCNPJ, formatPhone, validateCNPJ } from "@/lib/cnpjValidation";
import { getCurrentTenantId } from "@/lib/tenant";
import type { Carrier } from "@/hooks/useCarriers";

const UF_OPTIONS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

interface FormValues extends BankValues {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  inscricao_estadual: string;
  ie_isento: boolean;
  telefone: string;
  email: string;
  cidade: string;
  uf: string;
}

const empty = (): FormValues => ({
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  inscricao_estadual: "",
  ie_isento: false,
  telefone: "",
  email: "",
  cidade: "",
  uf: "",
  banco: "",
  agencia: "",
  conta: "",
  tipo_conta: "",
  chave_pix: "",
});

type Errors = Partial<Record<"razao_social" | "cnpj" | "inscricao_estadual" | "email", string>>;

/** Cadastro e edicao da transportadora: dados cadastrais e dados bancarios/Pix. */
export function CarrierDialog({ open, onOpenChange, carrier, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; carrier: Carrier | null; onSaved: () => void }) {
  const [values, setValues] = useState<FormValues>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [tab, setTab] = useState("dados");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab("dados");
    setErrors({});
    setValues(
      carrier
        ? {
            razao_social: carrier.razao_social,
            nome_fantasia: carrier.nome_fantasia ?? "",
            cnpj: formatCNPJ(carrier.cnpj),
            inscricao_estadual: carrier.inscricao_estadual ?? "",
            ie_isento: carrier.ie_isento,
            telefone: carrier.telefone ?? "",
            email: carrier.email ?? "",
            cidade: carrier.cidade ?? "",
            uf: carrier.uf ?? "",
            banco: carrier.banco ?? "",
            agencia: carrier.agencia ?? "",
            conta: carrier.conta ?? "",
            tipo_conta: carrier.tipo_conta ?? "",
            chave_pix: carrier.chave_pix ?? "",
          }
        : empty(),
    );
  }, [open, carrier]);

  const update = (patch: Partial<FormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    const keys = Object.keys(patch) as (keyof Errors)[];
    if (keys.some((key) => errors[key])) setErrors((current) => Object.fromEntries(Object.entries(current).filter(([k]) => !keys.includes(k as keyof Errors))));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found: Errors = {};
    const cnpj = values.cnpj.replace(/\D/g, "");
    if (values.razao_social.trim().length < 2) found.razao_social = "Informe a razão social.";
    if (cnpj.length !== 14 || !validateCNPJ(cnpj)) found.cnpj = "CNPJ inválido. Confira os 14 números.";
    if (!values.ie_isento && !values.inscricao_estadual.trim()) found.inscricao_estadual = "Informe a inscrição estadual ou marque “Isenta”.";
    if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) found.email = "E-mail inválido.";
    setErrors(found);
    const first = (["razao_social", "cnpj", "inscricao_estadual", "email"] as const).find((key) => found[key]);
    if (first) {
      setTab("dados");
      window.setTimeout(() => document.getElementById(`carrier-${first}`)?.focus(), 30);
      return;
    }
    setSaving(true);
    const row = {
      razao_social: values.razao_social.trim(),
      nome_fantasia: values.nome_fantasia.trim() || null,
      cnpj,
      inscricao_estadual: values.ie_isento ? null : values.inscricao_estadual.trim(),
      ie_isento: values.ie_isento,
      telefone: values.telefone.trim() || null,
      email: values.email.trim().toLowerCase() || null,
      cidade: values.cidade.trim() || null,
      uf: values.uf || null,
      banco: values.banco.trim() || null,
      agencia: values.agencia.trim() || null,
      conta: values.conta.trim() || null,
      tipo_conta: values.tipo_conta || null,
      chave_pix: values.chave_pix.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = carrier
      ? await supabase.from("carriers").update(row).eq("id", carrier.id)
      : await supabase.from("carriers").insert({ ...row, tenant_id: (await getCurrentTenantId())! });
    setSaving(false);
    if (error) {
      const duplicate = error.code === "23505";
      if (duplicate) {
        setErrors({ cnpj: "Já existe uma transportadora com este CNPJ." });
        setTab("dados");
      }
      toast({
        title: "Não foi possível salvar a transportadora",
        description: duplicate ? "Já existe uma transportadora com este CNPJ." : "Confira a internet e tente de novo.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: carrier ? "Transportadora atualizada" : "Transportadora cadastrada", description: row.nome_fantasia || row.razao_social });
    onSaved();
    onOpenChange(false);
  };

  const dataHasError = Boolean(errors.razao_social || errors.cnpj || errors.inscricao_estadual || errors.email);

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden sm:max-w-xl">
        <DialogHeader className="pb-4">
          <DialogTitle>{carrier ? "Editar transportadora" : "Cadastrar transportadora"}</DialogTitle>
          <DialogDescription>O acerto dos motoristas ligados a ela sai para estes dados bancários.</DialogDescription>
        </DialogHeader>
        <form id="carrier-form" noValidate onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dados" className="gap-1.5">
                <Building2 aria-hidden="true" />
                Dados cadastrais
                <TabErrorDot show={dataHasError} />
              </TabsTrigger>
              <TabsTrigger value="banco" className="gap-1.5">
                <Landmark aria-hidden="true" />
                Banco e Pix
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="mt-5 space-y-4">
              <FormField id="carrier-razao_social" label="Razão social" required error={errors.razao_social}>
                {(control) => <Input {...control} value={values.razao_social} onChange={(e) => update({ razao_social: e.target.value })} autoComplete="off" />}
              </FormField>
              <FormField id="carrier-nome_fantasia" label="Nome fantasia" optional>
                {(control) => <Input {...control} value={values.nome_fantasia} onChange={(e) => update({ nome_fantasia: e.target.value })} autoComplete="off" />}
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="carrier-cnpj" label="CNPJ" required error={errors.cnpj}>
                  {(control) => (
                    <Input {...control} inputMode="numeric" placeholder="00.000.000/0000-00" maxLength={18} value={values.cnpj} onChange={(e) => update({ cnpj: formatCNPJ(e.target.value) })} className="font-data" />
                  )}
                </FormField>
                <div className="space-y-2">
                  <FormField id="carrier-inscricao_estadual" label="Inscrição estadual" required={!values.ie_isento} error={errors.inscricao_estadual}>
                    {(control) => (
                      <Input
                        {...control}
                        disabled={values.ie_isento}
                        value={values.ie_isento ? "" : values.inscricao_estadual}
                        placeholder={values.ie_isento ? "Isenta" : "Número da IE"}
                        onChange={(e) => update({ inscricao_estadual: e.target.value })}
                        className="font-data"
                      />
                    )}
                  </FormField>
                  <div className="flex items-center gap-2">
                    <Checkbox id="carrier-ie-isento" checked={values.ie_isento} onCheckedChange={(checked) => update({ ie_isento: checked === true, inscricao_estadual: "" })} />
                    <Label htmlFor="carrier-ie-isento" className="font-normal">
                      Isenta de inscrição estadual
                    </Label>
                  </div>
                </div>
                <FormField id="carrier-telefone" label="Telefone" optional>
                  {(control) => <Input {...control} inputMode="tel" value={values.telefone} onChange={(e) => update({ telefone: formatPhone(e.target.value) })} />}
                </FormField>
                <FormField id="carrier-email" label="E-mail" optional error={errors.email}>
                  {(control) => <Input {...control} type="email" inputMode="email" value={values.email} onChange={(e) => update({ email: e.target.value })} />}
                </FormField>
                <FormField id="carrier-cidade" label="Cidade" optional>
                  {(control) => <Input {...control} value={values.cidade} onChange={(e) => update({ cidade: e.target.value })} />}
                </FormField>
                <FormField id="carrier-uf" label="Estado" optional>
                  {(control) => (
                    <Select value={values.uf} onValueChange={(uf) => update({ uf })}>
                      <SelectTrigger {...control}>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {UF_OPTIONS.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
              </div>
            </TabsContent>

            <TabsContent value="banco" className="mt-5">
              <BankFields idPrefix="carrier-" values={values} onChange={update} />
            </TabsContent>
          </Tabs>
        </form>
        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="carrier-form" disabled={saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {saving ? "Salvando..." : carrier ? "Salvar alterações" : "Cadastrar transportadora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
