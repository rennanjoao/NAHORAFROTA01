import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Building2, User, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import nahoraFrotaLogo from "@/assets/nahora-frota-logo.png";

// CNPJ validation
function isValidCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;

  const calc = (digits: string, weights: number[]) =>
    digits.split("").reduce((sum, d, i) => sum + Number(d) * weights[i], 0);

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = ((r) => (r < 2 ? 0 : 11 - r))(calc(cleaned.slice(0, 12), w1) % 11);
  const d2 = ((r) => (r < 2 ? 0 : 11 - r))(calc(cleaned.slice(0, 13), w2) % 11);

  return Number(cleaned[12]) === d1 && Number(cleaned[13]) === d2;
}

function formatCNPJ(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 14);
  return cleaned
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

const registerSchema = z.object({
  cnpj: z.string().refine((v) => isValidCNPJ(v), "CNPJ inválido"),
  razaoSocial: z.string().min(3, "Razão Social deve ter ao menos 3 caracteres"),
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
});

async function getFunctionErrorMessage(error: any): Promise<string> {
  const fallback = error?.message || "Erro ao processar cadastro";
  const response = error?.context;

  if (!response || typeof response.clone !== "function") {
    return fallback;
  }

  try {
    const payload = await response.clone().json();
    return payload?.error || payload?.message || fallback;
  } catch {
    try {
      const text = await response.clone().text();
      return text || fallback;
    } catch {
      return fallback;
    }
  }
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const cleanCnpj = cnpj.replace(/\D/g, "");

    const validation = registerSchema.safeParse({
      cnpj: cleanCnpj,
      razaoSocial: razaoSocial.trim(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
    });

    if (!validation.success) {
      toast({
        title: "Erro de validação",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("register-tenant", {
        body: {
          cnpj: cleanCnpj,
          razao_social: razaoSocial.trim(),
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
        },
      });

      if (error) {
        toast({
          title: "Erro no cadastro",
          description: await getFunctionErrorMessage(error),
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (data?.error) {
        toast({
          title: "Erro no cadastro",
          description: data.error,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      toast({
        title: "Erro",
        description: await getFunctionErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/50 shadow-xl">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Cadastro Enviado!</h2>
            <p className="text-muted-foreground text-sm">
              Sua empresa foi registrada com sucesso. O acesso será liberado após
              aprovação pela equipe Na Hora Frota.
            </p>
            <p className="text-muted-foreground text-xs">
              Você receberá uma notificação quando sua conta for ativada.
            </p>
            <Button onClick={() => navigate("/login")} className="w-full mt-4">
              Voltar ao Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-6">
          <img
            src={nahoraFrotaLogo}
            alt="NAHORA FROTA"
            className="w-48 h-auto object-contain"
            style={{
              filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))",
            }}
          />
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="pb-3 text-center">
            <h2 className="text-xl font-semibold">Cadastre sua Empresa</h2>
            <p className="text-sm text-muted-foreground">
              Preencha os dados para criar sua conta
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* CNPJ */}
              <div className="space-y-1.5">
                <Label htmlFor="cnpj">CNPJ</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    value={cnpj}
                    onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                    className="pl-10"
                    disabled={isLoading}
                    required
                    maxLength={18}
                  />
                </div>
              </div>

              {/* Razão Social */}
              <div className="space-y-1.5">
                <Label htmlFor="razao">Razão Social</Label>
                <Input
                  id="razao"
                  placeholder="Nome da Empresa LTDA"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Nome do Responsável */}
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome do Responsável</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Seu nome completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="empresa@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    disabled={isLoading}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {isLoading ? "Cadastrando..." : "Cadastrar Empresa"}
              </Button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Já tem conta?</span>
              </div>
            </div>

            <div className="text-center">
              <Link to="/login" className="text-sm text-primary hover:underline">
                Fazer login
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2024 Na Hora Transporte. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
