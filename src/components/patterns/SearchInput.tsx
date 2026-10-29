import { forwardRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Nome para leitor de tela (ex.: "Buscar motorista"). */
  label: string;
  className?: string;
  autoFocus?: boolean;
}

/** Campo de busca com lupa e botao de limpar. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, placeholder, label, className, autoFocus }, ref) => (
    <div className={cn("relative w-full sm:max-w-sm", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoFocus={autoFocus}
        className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Limpar busca"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  ),
);
SearchInput.displayName = "SearchInput";
