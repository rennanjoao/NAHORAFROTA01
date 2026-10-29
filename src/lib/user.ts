/** Nome do papel em linguagem simples (o mais alto que a pessoa tem). */
export function roleLabel(roles: readonly string[]): string {
  if (roles.includes("admin")) return "Administrador";
  if (roles.includes("fleet_manager")) return "Gestor de frota";
  if (roles.includes("dispatcher")) return "Despachante";
  return "Visualizador";
}

/** Ate duas iniciais ("Ana Admin" -> "AA"). */
export function initials(name: string | null | undefined): string {
  if (!name?.trim()) return "U";
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Primeiro nome, para saudacoes. */
export function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] || "";
}
