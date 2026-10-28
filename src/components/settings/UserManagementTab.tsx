import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Users, UserPlus, Crown, Shield, Edit, Trash2, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCompanyStore, SubUser, MasterUser } from "@/stores/companyStore";
import { formatPhone } from "@/lib/cnpjValidation";

const ACCESS_LEVELS = [
  { value: "admin", label: "Administrador", color: "bg-destructive text-destructive-foreground" },
  { value: "operacional", label: "Operacional", color: "bg-primary text-primary-foreground" },
  { value: "financeiro", label: "Financeiro", color: "bg-success text-success-foreground" },
  { value: "visualizacao", label: "Visualização", color: "bg-muted text-muted-foreground" },
];

export function UserManagementTab() {
  const { masterUser, setMasterUser, subUsers, addSubUser, updateSubUser, removeSubUser } = useCompanyStore();
  
  const [masterForm, setMasterForm] = useState<MasterUser>({
    name: masterUser?.name || "",
    cargo: masterUser?.cargo || "",
    telefone: masterUser?.telefone || "",
    email: masterUser?.email || "",
  });

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    cargo: "",
    accessLevel: "visualizacao" as SubUser["accessLevel"],
    active: true,
  });

  const handleSaveMaster = () => {
    if (!masterForm.name || !masterForm.email) {
      toast({
        title: "Campos Obrigatórios",
        description: "Nome e E-mail são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    setMasterUser(masterForm);
    toast({
      title: "✅ Usuário Master Salvo",
      description: "Informações do administrador principal atualizadas.",
    });
  };

  const handleAddUser = () => {
    if (!newUser.name || !newUser.email) {
      toast({
        title: "Campos Obrigatórios",
        description: "Nome e E-mail são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate email
    if (subUsers.some(u => u.email === newUser.email)) {
      toast({
        title: "E-mail Duplicado",
        description: "Já existe um usuário com este e-mail.",
        variant: "destructive",
      });
      return;
    }

    addSubUser(newUser);
    setNewUser({ name: "", email: "", cargo: "", accessLevel: "visualizacao", active: true });
    setIsAddUserOpen(false);
    toast({
      title: "✅ Usuário Adicionado",
      description: `${newUser.name} foi adicionado com sucesso.`,
    });
  };

  const handleToggleActive = (id: string, active: boolean) => {
    updateSubUser(id, { active });
    toast({
      title: active ? "Usuário Ativado" : "Usuário Desativado",
      description: `O acesso do usuário foi ${active ? "liberado" : "bloqueado"}.`,
    });
  };

  const handleRemoveUser = (id: string, name: string) => {
    removeSubUser(id);
    toast({
      title: "Usuário Removido",
      description: `${name} foi removido do sistema.`,
    });
  };

  const getAccessLevelBadge = (level: SubUser["accessLevel"]) => {
    const config = ACCESS_LEVELS.find(l => l.value === level);
    return config ? (
      <Badge className={config.color}>{config.label}</Badge>
    ) : null;
  };

  return (
    <div className="space-y-6">
      {/* Master User Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Usuário Master (Administrador Principal)
          </CardTitle>
          <CardDescription>
            Primeiro usuário cadastrado com acesso total ao sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="masterName">Nome Completo *</Label>
              <Input
                id="masterName"
                value={masterForm.name}
                onChange={(e) => setMasterForm({ ...masterForm, name: e.target.value })}
                placeholder="Nome do administrador"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="masterCargo">Cargo</Label>
              <Input
                id="masterCargo"
                value={masterForm.cargo}
                onChange={(e) => setMasterForm({ ...masterForm, cargo: e.target.value })}
                placeholder="Ex: Diretor, Gerente"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="masterEmail">E-mail *</Label>
              <Input
                id="masterEmail"
                type="email"
                value={masterForm.email}
                onChange={(e) => setMasterForm({ ...masterForm, email: e.target.value })}
                placeholder="email@empresa.com.br"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="masterTelefone">Telefone</Label>
              <Input
                id="masterTelefone"
                value={masterForm.telefone}
                onChange={(e) => setMasterForm({ ...masterForm, telefone: formatPhone(e.target.value) })}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
          <Button onClick={handleSaveMaster} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar Usuário Master
          </Button>
        </CardContent>
      </Card>

      {/* Sub Users Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários do Sistema
            </CardTitle>
            <CardDescription>
              Gerencie os acessos dos colaboradores
            </CardDescription>
          </div>
          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Adicionar Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Usuário</DialogTitle>
                <DialogDescription>
                  Adicione um colaborador e defina seu nível de acesso
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="newName">Nome Completo *</Label>
                  <Input
                    id="newName"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="Nome do colaborador"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newEmail">E-mail *</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="email@empresa.com.br"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newCargo">Cargo</Label>
                  <Input
                    id="newCargo"
                    value={newUser.cargo}
                    onChange={(e) => setNewUser({ ...newUser, cargo: e.target.value })}
                    placeholder="Ex: Analista, Coordenador"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newAccess">Nível de Acesso</Label>
                  <Select
                    value={newUser.accessLevel}
                    onValueChange={(value) => setNewUser({ ...newUser, accessLevel: value as SubUser["accessLevel"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCESS_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            {level.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddUser}>
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {subUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum usuário adicional cadastrado</p>
              <p className="text-sm">Clique em "Adicionar Usuário" para começar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Acesso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.cargo || "-"}</TableCell>
                    <TableCell>{getAccessLevelBadge(user.accessLevel)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={user.active}
                        onCheckedChange={(checked) => handleToggleActive(user.id, checked)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveUser(user.id, user.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
