import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, Plus, Link2, Phone, Mail, Building2, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Insurer {
  id: number;
  name: string;
  policyNumber: string;
  contact: string;
  email: string;
  status: "active" | "pending" | "expired";
  type: "full" | "basic";
}

const mockInsurers: Insurer[] = [
  { id: 1, name: "Buonny Gestão de Riscos", policyNumber: "POL-2024-001", contact: "(11) 3000-1234", email: "contato@buonny.com.br", status: "active", type: "full" },
  { id: 2, name: "Opentech Gerenciadora", policyNumber: "POL-2024-002", contact: "(11) 3000-5678", email: "suporte@opentech.com.br", status: "active", type: "full" },
  { id: 3, name: "AT&M Gerenciadora", policyNumber: "POL-2024-003", contact: "(11) 4000-9012", email: "comercial@atm.com.br", status: "pending", type: "basic" },
];

const integrationOptions = [
  { id: "buonny", name: "Buonny", description: "Gestão de Riscos completa com rastreamento", logo: "🔵" },
  { id: "opentech", name: "Opentech", description: "Gerenciamento e monitoramento 24h", logo: "🟢" },
  { id: "sascar", name: "Sascar", description: "Rastreamento e telemetria avançada", logo: "🟠" },
  { id: "autotrac", name: "Autotrac", description: "Monitoramento via satélite", logo: "🔴" },
];

export default function SeguradoresPage() {
  const [insurers, setInsurers] = useState<Insurer[]>(mockInsurers);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [isIntegrationDialogOpen, setIsIntegrationDialogOpen] = useState(false);
  const [newInsurer, setNewInsurer] = useState({ name: "", policyNumber: "", contact: "", email: "" });

  const handleAddInsurer = () => {
    if (!newInsurer.name || !newInsurer.policyNumber) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome e número da apólice.",
        variant: "destructive",
      });
      return;
    }

    const insurer: Insurer = {
      id: insurers.length + 1,
      ...newInsurer,
      status: "pending",
      type: "basic",
    };
    setInsurers([...insurers, insurer]);
    setNewInsurer({ name: "", policyNumber: "", contact: "", email: "" });
    setIsNewDialogOpen(false);
    toast({
      title: "✅ Seguradora Cadastrada",
      description: `${newInsurer.name} foi adicionada com sucesso.`,
    });
  };

  const handleConnect = (provider: string) => {
    toast({
      title: "🔗 Solicitação Enviada",
      description: `Integração com ${provider} solicitada. Aguarde contato comercial em até 24h.`,
    });
    setIsIntegrationDialogOpen(false);
  };

  const getStatusBadge = (status: Insurer["status"]) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success text-success-foreground">Ativa</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-warning border-warning">Pendente</Badge>;
      case "expired":
        return <Badge variant="destructive">Expirada</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-7 w-7 text-primary" />
              Seguradoras
            </h1>
            <p className="text-muted-foreground">Gerencie suas seguradoras e integrações de risco</p>
          </div>
          <div className="flex gap-3">
            <Dialog open={isIntegrationDialogOpen} onOpenChange={setIsIntegrationDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Link2 className="h-4 w-4" />
                  Contratar Integração
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Contratar Integração</DialogTitle>
                  <DialogDescription>
                    Escolha uma gerenciadora de risco para integrar ao seu sistema
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  {integrationOptions.map((option) => (
                    <Card 
                      key={option.id} 
                      className="p-4 cursor-pointer hover:border-primary transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-3xl">{option.logo}</div>
                        <div className="flex-1">
                          <h4 className="font-semibold">{option.name}</h4>
                          <p className="text-sm text-muted-foreground">{option.description}</p>
                          <Button 
                            size="sm" 
                            className="mt-3"
                            onClick={() => handleConnect(option.name)}
                          >
                            Conectar
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Cadastrar Nova
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Seguradora</DialogTitle>
                  <DialogDescription>
                    Cadastre uma nova seguradora ou gerenciadora de risco
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da Empresa *</Label>
                    <Input
                      id="name"
                      placeholder="Ex: Buonny Gestão de Riscos"
                      value={newInsurer.name}
                      onChange={(e) => setNewInsurer({ ...newInsurer, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="policy">Número da Apólice *</Label>
                    <Input
                      id="policy"
                      placeholder="Ex: POL-2024-001"
                      value={newInsurer.policyNumber}
                      onChange={(e) => setNewInsurer({ ...newInsurer, policyNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact">Telefone de Contato</Label>
                    <Input
                      id="contact"
                      placeholder="Ex: (11) 3000-1234"
                      value={newInsurer.contact}
                      onChange={(e) => setNewInsurer({ ...newInsurer, contact: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Ex: contato@empresa.com.br"
                      value={newInsurer.email}
                      onChange={(e) => setNewInsurer({ ...newInsurer, email: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsNewDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddInsurer}>Cadastrar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{insurers.filter(i => i.status === "active").length}</p>
                <p className="text-sm text-muted-foreground">Ativas</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-warning/10">
                <FileText className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{insurers.filter(i => i.status === "pending").length}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{insurers.length}</p>
                <p className="text-sm text-muted-foreground">Total Cadastradas</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seguradora</TableHead>
                <TableHead>Apólice</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insurers.map((insurer) => (
                <TableRow key={insurer.id}>
                  <TableCell className="font-medium">{insurer.name}</TableCell>
                  <TableCell>{insurer.policyNumber}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {insurer.contact || "-"}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {insurer.email || "-"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(insurer.status)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {insurer.type === "full" ? "Completa" : "Básica"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Ver Detalhes</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppLayout>
  );
}
