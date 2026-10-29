import { useState } from "react";
import { useForm } from "react-hook-form";
import { UserPlus, FileText, Briefcase, Car, ShieldCheck, Upload, Loader2, Check, Landmark } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface NewDriverModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DriverFormData {
  // Section A - Personal Documents
  fullName: string;
  cpf: string;
  rg: string;
  cnhNumber: string;
  cnhCategory: string;
  cnhExpiration: string;
  hasEAR: boolean;
  
  // Section B - Professional Data
  rntrcNumber: string;
  hasMOPP: boolean;
  moppExpiration: string;
  references: string;
  
  // Section C - Vehicle
  plate: string;
  model: string;
  renavam: string;
  isOwnFleet: boolean;
  
  // Section D - Risk Check
  criminalCheck: boolean;
  cnhPoints: boolean;
  judicialProcess: boolean;

  // Section E - Banking Info
  bankName: string;
  agency: string;
  accountNumber: string;
  pixKeyType: string;
  pixKeyValue: string;
}

export function NewDriverModal({ open, onOpenChange }: NewDriverModalProps) {
  const [activeTab, setActiveTab] = useState("documents");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({});
  
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<DriverFormData>({
    defaultValues: {
      hasEAR: false,
      hasMOPP: false,
      criminalCheck: false,
      cnhPoints: false,
      judicialProcess: false,
      isOwnFleet: false,
    }
  });

  const hasMOPP = watch("hasMOPP");
  const isOwnFleet = watch("isOwnFleet");

  const handleFileUpload = (fieldName: string) => {
    // Simulate file upload
    setUploadedFiles(prev => ({ ...prev, [fieldName]: `${fieldName}_uploaded.pdf` }));
    toast({
      title: "📎 Arquivo anexado",
      description: `Documento ${fieldName} carregado com sucesso.`,
      duration: 2000,
    });
  };

  const onSubmit = async (data: DriverFormData) => {
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsSubmitting(false);
    onOpenChange(false);
    reset();
    setUploadedFiles({});
    setActiveTab("documents");
    
    toast({
      title: "✅ Documentação enviada para análise de risco",
      description: "Buonny/Opentech irá processar a solicitação em até 24h.",
      duration: 5000,
    });
  };

  const tabs = [
    { id: "documents", label: "Documentos", icon: FileText },
    { id: "professional", label: "Profissional", icon: Briefcase },
    { id: "vehicle", label: "Veículo", icon: Car },
    { id: "banking", label: "Bancário", icon: Landmark },
    { id: "risk", label: "Validação", icon: ShieldCheck },
  ];

  const FileUploadButton = ({ label, fieldName }: { label: string; fieldName: string }) => (
    <div className="space-y-2">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <Button
        type="button"
        variant={uploadedFiles[fieldName] ? "secondary" : "outline"}
        className="w-full justify-start gap-2"
        onClick={() => handleFileUpload(fieldName)}
      >
        {uploadedFiles[fieldName] ? (
          <>
            <Check className="h-4 w-4 text-success" />
            <span className="text-success">Arquivo anexado</span>
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            <span>Selecionar arquivo</span>
          </>
        )}
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Cadastro para Gerenciamento de Risco
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid grid-cols-5 mb-4">
              {tabs.map((tab) => (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  className="flex items-center gap-1.5 text-xs sm:text-sm"
                >
                  <tab.icon className="h-4 w-4 hidden sm:block" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 overflow-y-auto pr-2">
              {/* Section A: Personal Documents */}
              <TabsContent value="documents" className="mt-0 space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Documentos Pessoais
                  </h4>
                  
                  <div className="grid gap-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Nome Completo *</Label>
                        <Input 
                          id="fullName"
                          placeholder="João da Silva Santos"
                          {...register("fullName", { required: true })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cpf">CPF *</Label>
                        <Input 
                          id="cpf"
                          placeholder="000.000.000-00"
                          {...register("cpf", { required: true })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rg">RG *</Label>
                      <Input 
                        id="rg"
                        placeholder="00.000.000-0"
                        {...register("rg", { required: true })}
                      />
                    </div>

                    <div className="border-t border-border pt-4 mt-2">
                      <h5 className="text-sm font-medium text-muted-foreground mb-3">Dados da CNH</h5>
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cnhNumber">Número CNH *</Label>
                          <Input 
                            id="cnhNumber"
                            placeholder="00000000000"
                            {...register("cnhNumber", { required: true })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cnhCategory">Categoria *</Label>
                          <Select onValueChange={(value) => setValue("cnhCategory", value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="C">C - Caminhão</SelectItem>
                              <SelectItem value="D">D - Ônibus/Van</SelectItem>
                              <SelectItem value="E">E - Articulado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cnhExpiration">Validade *</Label>
                          <Input 
                            id="cnhExpiration"
                            type="date"
                            {...register("cnhExpiration", { required: true })}
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-4">
                        <Checkbox 
                          id="hasEAR"
                          onCheckedChange={(checked) => setValue("hasEAR", !!checked)}
                        />
                        <Label htmlFor="hasEAR" className="text-sm cursor-pointer">
                          Possui EAR (Exerce Atividade Remunerada)?
                        </Label>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4 mt-2">
                      <h5 className="text-sm font-medium text-muted-foreground mb-3">Uploads de Documentos</h5>
                      <div className="grid sm:grid-cols-3 gap-4">
                        <FileUploadButton label="Foto Recente 3x4" fieldName="photo" />
                        <FileUploadButton label="Comprovante de Residência" fieldName="address_proof" />
                        <FileUploadButton label="Cópia CNH (Frente/Verso)" fieldName="cnh_copy" />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Section B: Professional Data */}
              <TabsContent value="professional" className="mt-0 space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" />
                    Dados Profissionais
                  </h4>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rntrcNumber">Número RNTRC (ANTT) *</Label>
                      <Input 
                        id="rntrcNumber"
                        placeholder="00000000"
                        {...register("rntrcNumber", { required: true })}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="hasMOPP"
                        onCheckedChange={(checked) => setValue("hasMOPP", !!checked)}
                      />
                      <Label htmlFor="hasMOPP" className="text-sm cursor-pointer">
                        Possui MOPP (Movimentação de Produtos Perigosos)?
                      </Label>
                    </div>

                    {hasMOPP && (
                      <div className="space-y-2 pl-6">
                        <Label htmlFor="moppExpiration">Validade MOPP</Label>
                        <Input 
                          id="moppExpiration"
                          type="date"
                          {...register("moppExpiration")}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="references">Referências Profissionais</Label>
                      <Textarea 
                        id="references"
                        placeholder="Nome da empresa, cargo ocupado, telefone de contato..."
                        rows={4}
                        {...register("references")}
                      />
                    </div>

                    <FileUploadButton label="Ficha de Registro / CV" fieldName="cv" />
                  </div>
                </div>
              </TabsContent>

              {/* Section C: Vehicle */}
              <TabsContent value="vehicle" className="mt-0 space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" />
                    Veículo Vinculado
                  </h4>

                  <div className="grid gap-4">
                    {/* Fleet Type Selection */}
                    <div className="space-y-2">
                      <Label>Vínculo do Veículo *</Label>
                      <Select
                        value={isOwnFleet ? "own" : "third"}
                        onValueChange={(value) => setValue("isOwnFleet", value === "own")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo de vínculo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="own">🏢 Frota Própria (não gera valor a receber)</SelectItem>
                          <SelectItem value="third">🚚 Terceiro / Agregado (gera valor a receber)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Motoristas de frota própria não geram valores a pagar no acerto financeiro.
                      </p>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="plate">Placa *</Label>
                        <Input 
                          id="plate"
                          placeholder="ABC-1234"
                          className="uppercase"
                          {...register("plate", { required: true })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="model">Modelo *</Label>
                        <Input 
                          id="model"
                          placeholder="Sprinter 415"
                          {...register("model", { required: true })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="renavam">RENAVAM *</Label>
                        <Input 
                          id="renavam"
                          placeholder="00000000000"
                          {...register("renavam", { required: true })}
                        />
                      </div>
                    </div>

                    <div className="border-t border-border pt-4 mt-2">
                      <h5 className="text-sm font-medium text-muted-foreground mb-3">Documentos do Veículo</h5>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <FileUploadButton label="CRLV (Licenciamento)" fieldName="crlv" />
                        <FileUploadButton label="Comprovante de Rastreador" fieldName="tracker" />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Section E: Banking Info */}
              <TabsContent value="banking" className="mt-0 space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-primary" />
                    Dados Bancários
                  </h4>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bankName">Nome do Banco *</Label>
                      <Input 
                        id="bankName"
                        placeholder="Ex: Banco do Brasil, Itaú, Bradesco..."
                        {...register("bankName", { required: true })}
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="agency">Agência *</Label>
                        <Input 
                          id="agency"
                          placeholder="0000"
                          {...register("agency", { required: true })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="accountNumber">Conta (com dígito) *</Label>
                        <Input 
                          id="accountNumber"
                          placeholder="00000-0"
                          {...register("accountNumber", { required: true })}
                        />
                      </div>
                    </div>

                    <div className="border-t border-border pt-4 mt-2">
                      <h5 className="text-sm font-medium text-muted-foreground mb-3">Dados PIX</h5>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="pixKeyType">Tipo de Chave PIX *</Label>
                          <Select onValueChange={(value) => setValue("pixKeyType", value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cpf">CPF</SelectItem>
                              <SelectItem value="email">E-mail</SelectItem>
                              <SelectItem value="phone">Telefone</SelectItem>
                              <SelectItem value="random">Chave Aleatória</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pixKeyValue">Chave PIX *</Label>
                          <Input 
                            id="pixKeyValue"
                            placeholder="Digite a chave PIX"
                            {...register("pixKeyValue", { required: true })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Section F: Risk Pre-Validation */}
              <TabsContent value="risk" className="mt-0 space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Pré-Validação (Risk Check)
                  </h4>

                  <p className="text-sm text-muted-foreground mb-4">
                    Itens verificados automaticamente pela gerenciadora de risco após o envio:
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Antecedentes Criminais</p>
                          <p className="text-xs text-muted-foreground">Consulta em bases estaduais e federais</p>
                        </div>
                      </div>
                      <Checkbox 
                        id="criminalCheck"
                        onCheckedChange={(checked) => setValue("criminalCheck", !!checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Pontuação CNH</p>
                          <p className="text-xs text-muted-foreground">Verificação de pontos e suspensões</p>
                        </div>
                      </div>
                      <Checkbox 
                        id="cnhPoints"
                        onCheckedChange={(checked) => setValue("cnhPoints", !!checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Processos Judiciais</p>
                          <p className="text-xs text-muted-foreground">Consulta em tribunais de justiça</p>
                        </div>
                      </div>
                      <Checkbox 
                        id="judicialProcess"
                        onCheckedChange={(checked) => setValue("judicialProcess", !!checked)}
                      />
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm text-primary font-medium">
                      ⚠️ A validação completa será realizada pela Buonny/Opentech após o envio.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
              <div className="flex gap-2">
                {activeTab !== "documents" && (
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      const currentIndex = tabs.findIndex(t => t.id === activeTab);
                      if (currentIndex > 0) setActiveTab(tabs[currentIndex - 1].id);
                    }}
                  >
                    Anterior
                  </Button>
                )}
                {activeTab !== "risk" && (
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      const currentIndex = tabs.findIndex(t => t.id === activeTab);
                      if (currentIndex < tabs.length - 1) setActiveTab(tabs[currentIndex + 1].id);
                    }}
                  >
                    Próximo
                  </Button>
                )}
              </div>

              <Button 
                type="submit" 
                className="bg-primary hover:bg-primary/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Enviar para Seguradora
                  </>
                )}
              </Button>
            </div>
          </Tabs>
        </form>
      </DialogContent>
    </Dialog>
  );
}
