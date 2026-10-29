import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { brandAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";

// Primeiro e ultimo nome, como o avatar da tela de Motoristas ("João Ângelo da Silva" = JS).
const CONNECTORS = new Set(["da", "das", "de", "do", "dos", "e"]);
function initialsOf(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((part) => part && !CONNECTORS.has(part.toLowerCase()));
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Foto do motorista; sem foto, mostra as iniciais. Decorativa: o nome vem ao lado. */
export function DriverAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return (
    <Avatar className={cn("h-9 w-9", className)} aria-hidden="true">
      {src && <AvatarImage src={brandAvatar(src)} alt="" className="object-cover" />}
      <AvatarFallback className="bg-primary/10 font-heading text-primary">{initialsOf(name) || "?"}</AvatarFallback>
    </Avatar>
  );
}
