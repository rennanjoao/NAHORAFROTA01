// Hierarquia de papeis do painel e o que cada um pode fazer.
// Mantenha alinhado com as regras do banco (RLS) e das edge functions.

export type SystemRole = "admin" | "fleet_manager" | "dispatcher" | "viewer";

export interface RoleDefinition {
  role: SystemRole;
  label: string;
  description: string;
}

/** Do mais alto para o mais baixo. */
export const ROLE_HIERARCHY: RoleDefinition[] = [
  {
    role: "admin",
    label: "Administrador",
    description: "Responsável pela conta: dados da empresa, usuários, plano e toda a operação.",
  },
  {
    role: "fleet_manager",
    label: "Gestor de Frota",
    description: "Toda a operação, incluindo cadastro de motoristas com acesso ao app.",
  },
  {
    role: "dispatcher",
    label: "Despachante",
    description: "Dia a dia da operação: notas, romaneios, entregas e ocorrências.",
  },
  {
    role: "viewer",
    label: "Motorista (app)",
    description: "Login do app do motorista: vê apenas as próprias entregas.",
  },
];

/** Niveis que podem ser atribuidos a usuarios do painel ("viewer" e o login do app do motorista). */
export const PANEL_ROLES = ROLE_HIERARCHY.filter((r) => r.role !== "viewer");

export interface PermissionDefinition {
  label: string;
  roles: SystemRole[];
}

export const ROLE_PERMISSIONS: PermissionDefinition[] = [
  { label: "Alterar dados da empresa", roles: ["admin"] },
  { label: "Gerenciar usuários e níveis de acesso", roles: ["admin"] },
  { label: "Área Administrativa (plano e usuários)", roles: ["admin"] },
  { label: "Cadastrar motoristas com login no app", roles: ["admin", "fleet_manager"] },
  { label: "Importar NFs, criar romaneios e baixar entregas", roles: ["admin", "fleet_manager", "dispatcher"] },
  { label: "Dashboard, mapa e relatórios", roles: ["admin", "fleet_manager", "dispatcher"] },
];

export function getRoleLabel(role: string): string {
  return ROLE_HIERARCHY.find((r) => r.role === role)?.label ?? role;
}

/** Papel mais alto entre os papeis do usuario. */
export function getHighestRole(roles: string[]): SystemRole | null {
  return ROLE_HIERARCHY.find((r) => roles.includes(r.role))?.role ?? null;
}
