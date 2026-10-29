import { useSearchParams } from "react-router-dom";
import { Building2, Palette, Settings, Shield, User, Users, type LucideIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/patterns";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { CompanySettingsTab } from "@/components/settings/CompanySettingsTab";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { UserHierarchyTab } from "@/components/settings/UserHierarchyTab";
import { cn } from "@/lib/utils";

type SettingsTab = "profile" | "security" | "appearance" | "company" | "users";

interface TabItem {
  value: SettingsTab;
  label: string;
  /** Rotulo curto da grade do celular. */
  short: string;
  description: string;
  icon: LucideIcon;
}

const GROUPS: { id: string; label: string; items: TabItem[] }[] = [
  {
    id: "conta",
    label: "Sua conta",
    items: [
      { value: "profile", label: "Perfil", short: "Perfil", description: "Nome e telefone", icon: User },
      { value: "security", label: "Segurança", short: "Segurança", description: "Senha e aparelhos", icon: Shield },
      { value: "appearance", label: "Aparência", short: "Aparência", description: "Tema, texto e contraste", icon: Palette },
    ],
  },
  {
    id: "empresa",
    label: "Empresa",
    items: [
      { value: "company", label: "Dados da empresa", short: "Empresa", description: "Cadastro e endereço", icon: Building2 },
      { value: "users", label: "Usuários e acesso", short: "Usuários", description: "Quem pode fazer o quê", icon: Users },
    ],
  },
];

const TAB_VALUES = GROUPS.flatMap((group) => group.items.map((item) => item.value));

// Links antigos e nomes em portugues tambem abrem a aba certa (?tab=...).
const TAB_ALIASES: Record<string, SettingsTab> = {
  perfil: "profile",
  account: "profile",
  seguranca: "security",
  senha: "security",
  password: "security",
  aparencia: "appearance",
  acessibilidade: "appearance",
  theme: "appearance",
  tema: "appearance",
  empresa: "company",
  usuarios: "users",
  equipe: "users",
  team: "users",
};

function resolveTab(param: string | null): SettingsTab {
  if (!param) return "profile";
  const key = param.toLowerCase();
  if ((TAB_VALUES as string[]).includes(key)) return key as SettingsTab;
  return TAB_ALIASES[key] ?? "profile";
}

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = resolveTab(searchParams.get("tab"));

  const changeTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        icon={Settings}
        title="Configurações"
        description="Seu perfil, a aparência do sistema e os dados da empresa."
      />

      <Tabs
        value={tab}
        onValueChange={changeTab}
        orientation="vertical"
        // Manual: com duas listas (Sua conta / Empresa), o Tab entre elas nao troca a secao sozinho.
        activationMode="manual"
        className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10"
      >
        <nav aria-label="Seções das configurações" className="lg:sticky lg:top-[calc(var(--topbar-height)+2rem)] lg:self-start">
          <div className="space-y-4 lg:space-y-6">
            {GROUPS.map((group) => (
              <div key={group.id} className="space-y-1.5">
                <p id={`config-grupo-${group.id}`} className="nhf-label px-1 text-muted-foreground lg:px-3">
                  {group.label}
                </p>
                <TabsList
                  aria-labelledby={`config-grupo-${group.id}`}
                  className={cn(
                    "grid h-auto w-full gap-1.5 bg-transparent p-0",
                    group.items.length === 3 ? "grid-cols-3" : "grid-cols-2",
                    "lg:flex lg:flex-col lg:items-stretch lg:gap-0.5",
                  )}
                >
                  {group.items.map(({ value, label, short, description, icon: Icon }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className={cn(
                        "group relative flex-col gap-1.5 rounded-lg border bg-card px-2 py-3 text-[0.8125rem] text-muted-foreground shadow-xs",
                        "hover:bg-accent hover:text-foreground",
                        "data-[state=active]:border-primary/40 data-[state=active]:bg-primary/5 data-[state=active]:text-foreground data-[state=active]:shadow-xs",
                        "lg:min-h-0 lg:flex-row lg:items-center lg:justify-start lg:gap-3 lg:whitespace-normal lg:border-transparent lg:bg-transparent lg:px-3 lg:py-2 lg:text-left lg:text-sm lg:shadow-none",
                        "lg:data-[state=active]:border-transparent lg:data-[state=active]:bg-accent lg:data-[state=active]:shadow-none",
                      )}
                    >
                      {/* Indicador verde da aba ativa no computador */}
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-2 left-0 hidden w-[3px] rounded-full bg-brand opacity-0 transition-opacity duration ease-out group-data-[state=active]:opacity-100 lg:block"
                      />
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast group-hover:text-foreground group-data-[state=active]:text-primary lg:bg-muted/60 lg:group-data-[state=active]:bg-primary/10"
                      >
                        <Icon className="h-[1.125rem] w-[1.125rem]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium lg:hidden">{short}</span>
                        <span className="hidden font-medium lg:block">{label}</span>
                        <span className="hidden text-xs font-normal text-muted-foreground lg:block">{description}</span>
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0 max-w-4xl">
          <TabsContent value="profile" className="mt-0">
            <ProfileSettings />
          </TabsContent>
          <TabsContent value="security" className="mt-0">
            <SecuritySettings />
          </TabsContent>
          <TabsContent value="appearance" className="mt-0">
            <AppearanceSettings />
          </TabsContent>
          <TabsContent value="company" className="mt-0">
            <CompanySettingsTab />
          </TabsContent>
          <TabsContent value="users" className="mt-0">
            <UserHierarchyTab />
          </TabsContent>
        </div>
      </Tabs>
    </>
  );
}
