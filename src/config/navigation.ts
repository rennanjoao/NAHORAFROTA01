import {
  BarChart3,
  Crown,
  Home,
  Package,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Feature } from "@/hooks/useFeatureAccess";

/**
 * Mapa do sistema. Fonte unica para o menu lateral, a barra inferior do celular,
 * a busca (Ctrl K), o titulo da aba, o caminho "Grupo > Tela" e a ajuda de cada
 * tela. Para criar uma tela nova, acrescente aqui e registre a rota em App.tsx.
 */

export type NavGroupId = "operacao" | "frota" | "financeiro" | "gestao";

export interface NavGroup {
  id: NavGroupId;
  label: string;
}

export interface NavItem {
  path: string;
  label: string;
  /** Rotulo curto para a barra inferior do celular. */
  shortLabel?: string;
  /** Uma frase, em linguagem simples, do que se faz nesta tela. */
  description: string;
  icon: LucideIcon;
  group: NavGroupId;
  /** Recurso do plano que libera a tela. */
  feature?: Feature;
  adminOnly?: boolean;
  platformAdminOnly?: boolean;
  /** Palavras que a busca tambem aceita (sinonimos do dia a dia). */
  keywords?: string[];
  /** Atalho "g + tecla". */
  shortcut?: string;
  /** Passo a passo mostrado em "Ajuda". */
  tips: string[];
  /** Fora do menu e da busca (so titulo, caminho e ajuda). */
  hidden?: boolean;
}

export const NAV_GROUPS: NavGroup[] = [
  { id: "operacao", label: "Operação" },
  { id: "frota", label: "Frota" },
  { id: "financeiro", label: "Financeiro" },
  { id: "gestao", label: "Gestão" },
];

export const NAV_ITEMS: NavItem[] = [
  {
    path: "/",
    label: "Início",
    description: "Resumo do dia: quem está em rota, o que foi entregue e o que precisa de atenção.",
    icon: Home,
    group: "operacao",
    keywords: ["dashboard", "painel", "resumo", "hoje", "mapa ao vivo"],
    shortcut: "i",
    tips: [
      "Os números do topo mostram o dia de hoje. Toque em um deles para ver a lista completa.",
      "O mapa ao vivo mostra onde cada motorista está agora.",
      "Os avisos em amarelo ou vermelho pedem atenção: atrasos, ocorrências e notas sem romaneio.",
    ],
  },
  {
    path: "/deliveries",
    label: "Entregas",
    description: "Notas fiscais, romaneios e o andamento de cada entrega.",
    icon: Package,
    group: "operacao",
    keywords: ["nf", "nota fiscal", "notas", "romaneio", "xml", "importar", "carga"],
    shortcut: "e",
    tips: [
      "Comece importando os arquivos XML das notas em “Importar notas”.",
      "Selecione as notas e use “Gerar romaneio” para montar a rota de um motorista.",
      "Use a busca e os filtros para achar uma nota pelo número, cliente ou endereço.",
    ],
  },
  {
    path: "/routes",
    label: "Áreas de risco",
    description: "Onde mais acontecem roubos de carga, para planejar rotas e horários mais seguros.",
    icon: ShieldAlert,
    group: "operacao",
    keywords: ["mapa", "risco", "zona", "alerta", "região", "segurança", "roubo", "carga"],
    shortcut: "r",
    tips: [
      "Quanto maior e mais vermelho o círculo, mais roubos de carga a região teve.",
      "Toque em uma região para ver as rodovias perigosas e o que fazer.",
      "Use “Quando o risco é maior” para escolher horários mais seguros.",
    ],
  },
  {
    path: "/drivers",
    label: "Motoristas",
    description: "Cadastro, documentos, acesso ao aplicativo e desempenho dos motoristas.",
    icon: Users,
    group: "frota",
    keywords: ["motorista", "entregador", "agregado", "cpf", "cnh", "terceiro"],
    shortcut: "m",
    tips: [
      "Toque em “Novo motorista” para cadastrar. O motorista recebe o login do aplicativo.",
      "Abra um motorista para ver documentos, entregas e avaliação.",
    ],
  },
  {
    path: "/vehicles",
    label: "Veículos",
    description: "Veículos próprios da empresa: placa, situação e quem está usando.",
    icon: Truck,
    group: "frota",
    keywords: ["veículo", "placa", "caminhão", "van", "carro", "frota própria"],
    shortcut: "v",
    tips: [
      "Cadastre cada veículo da empresa com placa e modelo.",
      "A situação mostra se o veículo está livre, em uso ou em manutenção.",
    ],
  },
  {
    path: "/settlement",
    label: "Acerto financeiro",
    shortLabel: "Acerto",
    description: "Quanto pagar a cada motorista, o que já foi pago e o que está pendente.",
    icon: Wallet,
    group: "financeiro",
    feature: "financial_dashboard",
    keywords: ["financeiro", "pagamento", "acerto", "frete", "pagar", "pix"],
    shortcut: "a",
    tips: [
      "Escolha o período e o motorista para ver os romaneios a pagar.",
      "Marque como pago depois de fazer o pagamento; o motorista vê no aplicativo.",
    ],
  },
  {
    path: "/reports",
    label: "Relatórios",
    description: "SLA, custos, eficiência e ocorrências por período.",
    icon: BarChart3,
    group: "financeiro",
    feature: "reports",
    keywords: ["relatório", "sla", "indicador", "gráfico", "exportar", "pdf"],
    shortcut: "l",
    tips: [
      "Escolha o período no topo; todos os gráficos acompanham.",
      "Use “Exportar” para baixar em PDF e enviar para quem precisa.",
    ],
  },
  {
    path: "/admin",
    label: "Administração",
    description: "Usuários, permissões e indicadores gerais da empresa.",
    icon: ShieldCheck,
    group: "gestao",
    adminOnly: true,
    keywords: ["admin", "usuários", "permissão", "acesso"],
    tips: ["Convide pessoas da equipe e defina o que cada uma pode fazer."],
  },
  {
    path: "/settings",
    label: "Configurações",
    description: "Dados da empresa, seu perfil, aparência e preferências.",
    icon: Settings,
    group: "gestao",
    keywords: ["configuração", "perfil", "empresa", "tema", "senha", "aparência", "acessibilidade"],
    shortcut: "c",
    tips: [
      "Em “Aparência” você escolhe tema claro ou escuro e aumenta o tamanho do texto.",
      "Em “Perfil” você troca seu nome e sua senha.",
    ],
  },
  {
    path: "/master",
    label: "Painel Master",
    description: "Gestão de todas as empresas da plataforma.",
    icon: Crown,
    group: "gestao",
    platformAdminOnly: true,
    keywords: ["master", "empresas", "plataforma", "assinaturas"],
    tips: ["Acompanhe as empresas, os testes grátis e as cobranças."],
  },
];

/** Telas sem item no menu, mas com titulo e ajuda. */
export const HIDDEN_ITEMS: NavItem[] = [
  {
    path: "/upgrade",
    label: "Plano e recursos",
    description: "Este recurso faz parte de outro plano. A equipe Na Hora Frota libera para você.",
    icon: Crown,
    group: "gestao",
    hidden: true,
    tips: ["Toque em “Falar com a equipe” para liberar o recurso no seu plano."],
  },
];

/** Telas da barra inferior do celular (na ordem). O resto fica em "Mais". */
export const MOBILE_PRIMARY_PATHS = ["/", "/deliveries", "/drivers", "/settlement"];

export function findNavItem(pathname: string): NavItem | undefined {
  if (pathname === "/") return NAV_ITEMS[0];
  return [...NAV_ITEMS, ...HIDDEN_ITEMS].find(
    (item) => item.path !== "/" && (pathname === item.path || pathname.startsWith(`${item.path}/`)),
  );
}

export const SUPPORT_EMAIL = "suporte@nahorafrota.com.br";
