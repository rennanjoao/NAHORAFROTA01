/** Iniciais para o avatar sem foto: primeiro e ultimo nome ("Joao Angelo da Silva" -> "JS"). */
export function initialsOf(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((part) => part[0]).join("").toUpperCase() || "M";
}

/** Nome curto para faixas estreitas ("Joao Angelo da Silva" -> "Joao Silva"). */
export function shortName(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  return `${parts[0]} ${parts[parts.length - 1]}`;
}
