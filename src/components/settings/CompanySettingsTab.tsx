import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Save, MapPin, CheckCircle2, AlertCircle, Loader2, Lock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCNPJ, validateCNPJ, formatPhone, formatCEP } from "@/lib/cnpjValidation";
import { supabase } from "@/integrations/supabase/client";
import { useTenantData } from "@/hooks/useTenantData";
import { useAuth } from "@/contexts/AuthContext";

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export function CompanySettingsTab() {
  const { tenant, isLoading: tenantLoading, updateTenant } = useTenantData();
  // Somente o Administrador altera os dados da empresa (regra tambem no banco).
  const { isAdmin } = useAuth();
  const canEdit = isAdmin();

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
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync form when tenant loads
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
      toast({ title: "Endereço Incompleto", description: "Preencha logradouro, cidade e UF.", variant: "destructive" });
      return;
    }
    setIsGeocoding(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" });
        setIsGeocoding(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('geocode-address', {
        headers: { Authorization: `Bearer ${token}` },
        body: { address: fullAddress },
      });

      if (error || !data?.success) {
        toast({ title: "Erro na Geocodificação", description: data?.error || error?.message || "Não foi possível obter as coordenadas.", variant: "destructive" });
      } else {
        setLatitude(data.latitude);
        setLongitude(data.longitude);
        toast({ title: "Coordenadas Obtidas", description: `Lat: ${data.latitude.toFixed(6)}, Lng: ${data.longitude.toFixed(6)}` });
      }
    } catch {
      toast({ title: "Erro na Geocodificação", description: "Não foi possível obter as coordenadas.", variant: "destructive" });
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSave = async () => {
    if (!razaoSocial) {
      toast({ title: "Campo Obrigatório", description: "Razão Social é obrigatório.", variant: "destructive" });
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
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando dados da empresa...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Dados da Empresa
        </CardTitle>
        <CardDescription>
          Configure os dados cadastrais e endereço base para roteirização
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!canEdit && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" />
            Somente o Administrador da conta pode alterar os dados da empresa.
          </div>
        )}
        <fieldset disabled={!canEdit} className="space-y-6 min-w-0">
        {/* Dados Cadastrais */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium border-b pb-2">Dados Cadastrais</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="razaoSocial">Razão Social *</Label>
              <Input id="razaoSocial" value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Nome empresarial completo" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <div className="relative">
                <Input id="cnpj" value={cnpj} disabled className="bg-muted pr-10" />
                {cnpjValid !== null && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {cnpjValid ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertCircle className="h-4 w-4 text-destructive" />}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">CNPJ não pode ser alterado</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" value={telefone} onChange={(e) => setTelefone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" />
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium border-b pb-2">Endereço da Base (Ponto de Partida)</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
            <div className="space-y-2 sm:col-span-4">
              <Label htmlFor="logradouro">Logradouro</Label>
              <Input id="logradouro" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} placeholder="Rua, Avenida, etc." />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="numero">Número</Label>
              <Input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="123" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input id="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Bairro" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uf">UF</Label>
              <Select value={uf} onValueChange={setUf}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {UF_OPTIONS.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input id="cep" value={cep} onChange={(e) => setCep(formatCEP(e.target.value))} placeholder="00000-000" />
            </div>
          </div>
        </div>

        {/* Geocodificação */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium border-b pb-2">Coordenadas GPS (Base)</h4>
          <div className="flex items-end gap-4">
            <div className="space-y-2 flex-1">
              <Label>Latitude</Label>
              <Input value={latitude?.toFixed(6) || ""} disabled placeholder="Não geocodificado" className="bg-muted" />
            </div>
            <div className="space-y-2 flex-1">
              <Label>Longitude</Label>
              <Input value={longitude?.toFixed(6) || ""} disabled placeholder="Não geocodificado" className="bg-muted" />
            </div>
            <Button variant="outline" onClick={handleGeocode} disabled={isGeocoding} className="gap-2">
              <MapPin className="h-4 w-4" />
              {isGeocoding ? "Geocodificando..." : "Obter Coordenadas"}
            </Button>
          </div>
          {latitude && longitude && (
            <p className="text-sm text-muted-foreground">✓ Coordenadas definidas. Este será o ponto de partida para todas as rotas.</p>
          )}
        </div>

        {canEdit && (
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? "Salvando..." : "Salvar Dados da Empresa"}
          </Button>
        )}
        </fieldset>
      </CardContent>
    </Card>
  );
}
