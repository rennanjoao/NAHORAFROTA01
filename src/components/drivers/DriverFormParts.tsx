import { useRef, useState } from "react";
import { Building2, Copy, Download, Eye, EyeOff, FileText, Loader2, Lock, Trash2, Truck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ACCOUNT_TYPES, DOCUMENT_ACCEPT } from "./driverConfig";
import { IconAction } from "./DriverBits";
import { FormField } from "./FormField";

// Borda vermelha no Select quando o campo tem erro (o Input ja faz isso sozinho).
export const invalidSelectClass = "aria-[invalid=true]:border-destructive";

/* Tipo de motorista ------------------------------------------------------ */

const DRIVER_KINDS = [
  { value: "third", id: "driver-kind-third", title: "Agregado", description: "Usa o próprio veículo e recebe por frete.", icon: Truck },
  // id mantido: atalhos e testes clicam em #new-own-fleet-toggle para escolher CLT.
  { value: "own", id: "new-own-fleet-toggle", title: "Da casa (CLT)", description: "Usa um veículo da empresa em cada rota.", icon: Building2 },
] as const;

/** Escolha entre agregado e motorista da casa, em dois cartoes. */
export function DriverKindChoice({ isOwnFleet, onChange, idPrefix = "" }: { isOwnFleet: boolean; onChange: (isOwnFleet: boolean) => void; idPrefix?: string }) {
  return (
    <RadioGroup
      value={isOwnFleet ? "own" : "third"}
      onValueChange={(value) => onChange(value === "own")}
      aria-label="Tipo de motorista"
      className="grid gap-2 sm:grid-cols-2"
    >
      {DRIVER_KINDS.map(({ value, id, title, description, icon: Icon }) => {
        const checked = (value === "own") === isOwnFleet;
        const itemId = `${idPrefix}${id}`;
        return (
          <Label
            key={value}
            htmlFor={itemId}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3.5 font-normal transition-colors duration-fast hover:border-foreground/20",
              checked && "border-primary/60 bg-primary/5 ring-1 ring-primary/30 hover:border-primary/60",
            )}
          >
            <RadioGroupItem id={itemId} value={value} className="mt-0.5" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {title}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{description}</span>
            </span>
          </Label>
        );
      })}
    </RadioGroup>
  );
}

/* Documento -------------------------------------------------------------- */

export interface DocumentSlotFile {
  name: string;
  uploadedAt: Date;
}

interface DocumentSlotProps {
  id: string;
  label: string;
  file?: DocumentSlotFile;
  uploading?: boolean;
  onFile: (file: File) => void | Promise<void>;
  /** Abrir/baixar: so aparecem quando informados. */
  onOpen?: () => void;
  onDownload?: () => void;
  onRemove?: () => void;
  /** Mostra o cadeado "Restrito" no lugar de abrir/baixar. */
  locked?: boolean;
  /** Texto do botao quando ainda nao ha arquivo (padrao: "Enviar"). */
  pickLabel?: string;
}

/** Um documento: estado (enviado ou nao) e acoes de enviar, abrir, baixar, trocar e remover. */
export function DocumentSlot({ id, label, file, uploading, onFile, onOpen, onDownload, onRemove, locked, pickLabel = "Enviar" }: DocumentSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = () => inputRef.current?.click();

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <input
        id={id}
        ref={inputRef}
        type="file"
        className="hidden"
        accept={DOCUMENT_ACCEPT}
        onChange={async (event) => {
          const picked = event.target.files?.[0];
          if (picked) await onFile(picked);
          event.target.value = "";
        }}
      />
      <span
        aria-hidden="true"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          file ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <FileText className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {file ? (
          <p className="truncate text-xs text-muted-foreground" title={file.name}>
            {file.name} · {file.uploadedAt.toLocaleDateString("pt-BR")}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum arquivo</p>
        )}
      </div>
      {file ? (
        <div className="flex shrink-0 items-center gap-0.5">
          {locked ? (
            <span className="mr-1 inline-flex items-center gap-1 text-xs text-muted-foreground" title="Só a equipe Na Hora abre este arquivo">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Restrito
            </span>
          ) : (
            <>
              {onOpen && <IconAction icon={Eye} label={`Abrir ${label}`} onClick={onOpen} />}
              {onDownload && <IconAction icon={Download} label={`Baixar ${label}`} onClick={onDownload} />}
            </>
          )}
          <IconAction icon={Upload} label={`Trocar ${label}`} onClick={pick} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" aria-hidden="true" /> : undefined}
          </IconAction>
          {onRemove && (
            <IconAction
              icon={Trash2}
              label={`Remover ${label}`}
              onClick={onRemove}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            />
          )}
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={pick} disabled={uploading} aria-label={`${pickLabel} ${label}`}>
          {uploading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
          {uploading ? "Enviando..." : pickLabel}
        </Button>
      )}
    </li>
  );
}

export function DocumentSlotList({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="space-y-3">
      {note}
      <ul className="divide-y rounded-lg border bg-card">{children}</ul>
      <p className="text-xs text-muted-foreground">Arquivos PDF, JPG ou PNG de até 10 MB.</p>
    </div>
  );
}

export function RestrictedDocumentsNote() {
  return (
    <Alert variant="info">
      <Lock aria-hidden="true" />
      <AlertDescription>Você pode enviar e trocar arquivos. Abrir e baixar é exclusivo da equipe Na Hora.</AlertDescription>
    </Alert>
  );
}

/* Dados bancarios -------------------------------------------------------- */

export interface BankValues {
  banco: string;
  agencia: string;
  conta: string;
  tipo_conta: string;
  chave_pix: string;
}

/** Banco, agencia, conta, tipo e chave PIX. Os ids saem de idPrefix + nome do campo. */
export function BankFields({ values, onChange, idPrefix }: { values: BankValues; onChange: (patch: Partial<BankValues>) => void; idPrefix: string }) {
  return (
    <div className="space-y-4">
      <FormField id={`${idPrefix}banco`} label="Banco">
        {(control) => (
          <Input {...control} value={values.banco} onChange={(e) => onChange({ banco: e.target.value })} placeholder="Ex.: Banco do Brasil, Itaú" autoComplete="off" />
        )}
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField id={`${idPrefix}agencia`} label="Agência">
          {(control) => <Input {...control} value={values.agencia} onChange={(e) => onChange({ agencia: e.target.value })} placeholder="1234" inputMode="numeric" />}
        </FormField>
        <FormField id={`${idPrefix}conta`} label="Conta com dígito">
          {(control) => <Input {...control} value={values.conta} onChange={(e) => onChange({ conta: e.target.value })} placeholder="56789-0" />}
        </FormField>
      </div>
      <FormField id={`${idPrefix}tipo_conta`} label="Tipo de conta">
        {(control) => (
          <Select value={values.tipo_conta} onValueChange={(value) => onChange({ tipo_conta: value })}>
            <SelectTrigger {...control}>
              <SelectValue placeholder="Escolha o tipo" />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField id={`${idPrefix}chave_pix`} label="Chave PIX" hint="CPF, e-mail, telefone ou chave aleatória, completa.">
        {(control) => <Input {...control} value={values.chave_pix} onChange={(e) => onChange({ chave_pix: e.target.value })} placeholder="Chave PIX" />}
      </FormField>
    </div>
  );
}

/* Login do aplicativo ---------------------------------------------------- */

interface AppLoginFieldsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  email: string;
  password: string;
  hasName: boolean;
}

/** Liga a criacao do login do app e mostra o e-mail e a senha gerados. */
export function AppLoginFields({ enabled, onEnabledChange, email, password, hasName }: AppLoginFieldsProps) {
  const [showPassword, setShowPassword] = useState(false);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copiado`, description: "Cole onde quiser enviar ao motorista." });
    } catch {
      toast({ title: "Não foi possível copiar", description: "Selecione o texto e copie manualmente.", variant: "destructive" });
    }
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="space-y-0.5">
          <Label htmlFor="create-login" className="cursor-pointer">
            Criar acesso ao aplicativo
          </Label>
          <p id="create-login-dica" className="text-xs text-muted-foreground">
            O motorista entra no app com o e-mail e a senha abaixo.
          </p>
        </div>
        <Switch id="create-login" aria-describedby="create-login-dica" checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      {enabled && (
        <div className="space-y-4 border-t bg-muted/30 p-4 animate-fade-in">
          {!hasName && (
            <Alert variant="warning">
              <AlertDescription>Preencha o nome do motorista para gerar o e-mail de acesso.</AlertDescription>
            </Alert>
          )}
          <FormField id="login-email" label="E-mail de acesso" hint="Gerado a partir do nome e do CPF.">
            {(control) => (
              <div className="flex gap-2">
                <Input {...control} type="email" value={email} readOnly className="flex-1 font-data" />
                <IconAction icon={Copy} label="Copiar e-mail de acesso" variant="outline" onClick={() => copy(email, "E-mail")} disabled={!email} />
              </div>
            )}
          </FormField>
          <FormField id="login-password" label="Senha inicial" hint="6 primeiros números do CPF + Na (ex.: 123456Na).">
            {(control) => (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input {...control} type={showPassword ? "text" : "password"} value={password} readOnly className="pr-11 font-data" />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                    className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
                <IconAction icon={Copy} label="Copiar senha inicial" variant="outline" onClick={() => copy(password, "Senha")} />
              </div>
            )}
          </FormField>
        </div>
      )}
    </div>
  );
}
