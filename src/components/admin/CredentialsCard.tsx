import { useState } from "react";
import { Check, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CredentialsCardProps {
  title: string;
  rows: { label: string; value: string; mono?: boolean }[];
  /** Texto copiado para a area de transferencia. */
  copyText: string;
  note?: string;
}

/** Dados de acesso recem-criados, com botao de copiar para repassar a pessoa. */
export function CredentialsCard({ title, rows, copyText, note }: CredentialsCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    toast.success("Dados de acesso copiados.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 animate-scale-in">
      <div className="rounded-lg border border-success/30 bg-success/5 p-4">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
          {title}
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className={cn("min-w-0 break-all font-medium text-foreground", row.mono && "font-data")}>{row.value}</dd>
            </div>
          ))}
        </dl>
        {note && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{note}</p>}
      </div>
      <Button type="button" onClick={handleCopy} className="w-full">
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? "Copiado" : "Copiar dados de acesso"}
      </Button>
    </div>
  );
}
