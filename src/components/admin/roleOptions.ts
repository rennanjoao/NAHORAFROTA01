/** Nomes dos niveis de acesso na Administracao. */
export const ADMIN_ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  fleet_manager: "Gestor de frota",
  dispatcher: "Despachante",
  viewer: "Visualizador",
};

/** Niveis que podem ser dados ao criar ou convidar alguem para o painel. */
export const INVITE_ROLES = [
  { value: "dispatcher", label: "Despachante", description: "Importa notas, cria romaneios e acompanha as entregas." },
  { value: "fleet_manager", label: "Gestor de frota", description: "Tudo do despachante, mais motoristas e veículos." },
  { value: "admin", label: "Administrador", description: "Acesso total, inclusive usuários, plano e dados da empresa." },
] as const;

/** Conferencia simples de formato; o servidor valida de novo. */
export const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
