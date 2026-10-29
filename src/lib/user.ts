/** Nome do papel em linguagem simples (o mais alto que a pessoa tem). */
export function roleLabel(roles: readonly string[]): string {
  if (roles.includes("admin")) return "Administrador";
  if (roles.includes("fleet_manager")) return "Gestor de frota";
  if (roles.includes("dispatcher")) return "Despachante";
  return "Visualizador";
}

/** Iniciais do primeiro e do ultimo nome ("Joao Angelo da Silva" -> "JS"). */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] ?? "";
  return `${first}${last}`.toUpperCase();
}

/** Primeiro nome, para saudacoes. */
export function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] || "";
}
