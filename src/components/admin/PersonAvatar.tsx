import { brandAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";

/** Foto ou iniciais de uma pessoa. Decorativo: o nome sempre aparece ao lado. */
export function PersonAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const initials =
    name
      .split(/\s+/)
      // So letras e numeros ("[Equipe] Ana" vira "EA", sem o colchete).
      .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ""))
      .filter(Boolean)
      .filter((part, index, parts) => index === 0 || index === parts.length - 1)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";

  // Avatar gerado de iniciais (DiceBear) vira as mesmas iniciais do sistema, em vez da imagem.
  const photo = src && !(src.includes("api.dicebear.com") && src.includes("/initials/")) ? src : null;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-heading text-[0.8125rem] font-semibold text-primary",
        className,
      )}
    >
      {photo ? <img src={brandAvatar(photo)} alt="" className="h-full w-full object-cover" /> : initials}
    </span>
  );
}
