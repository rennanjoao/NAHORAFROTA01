import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { brandAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter((part) => part.length > 2)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
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
