import { FileCode2, Globe, Smartphone, Satellite, Download, Users } from "lucide-react";

const ITEMS = [
  { icon: FileCode2, label: "XML da NF-e" },
  { icon: Globe, label: "Chrome, Edge e Safari" },
  { icon: Smartphone, label: "Android e iPhone" },
  { icon: Satellite, label: "Sem rastreador" },
  { icon: Download, label: "Sem instalação no PC" },
  { icon: Users, label: "Frota própria e agregados" },
];

/** Faixa: com o que o sistema funciona. */
export function Platforms() {
  return (
    <section className="border-y border-foreground/10 bg-card/50" aria-label="Com o que funciona">
      <div className="container flex flex-col items-center gap-4 py-6 lg:flex-row lg:justify-between">
        <p className="text-sm text-muted-foreground">Funciona com o que você já usa</p>
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {ITEMS.map((i) => (
            <li key={i.label} className="flex items-center gap-2 text-sm font-medium text-foreground/80">
              <i.icon aria-hidden="true" className="h-4 w-4 text-brand" />
              {i.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
