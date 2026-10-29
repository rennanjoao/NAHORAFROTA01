import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ListPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** Paginacao simples: anterior, "pagina x de y", proxima. */
export function ListPagination({ page, totalPages, onPageChange }: ListPaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3 pt-1">
      <Button variant="outline" size="sm" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
        <ChevronLeft aria-hidden="true" />
        {/* Celular bem estreito: so a seta (o nome continua para o leitor de tela). */}
        <span className="max-[379px]:sr-only">Anterior</span>
      </Button>
      {/* No celular so "1 de 2" (com texto "Maior" o botao Proxima saia da tela); o leitor ouve "Pagina". */}
      <p className="whitespace-nowrap text-sm text-muted-foreground" aria-live="polite">
        <span className="sr-only sm:not-sr-only">Página </span>
        <span className="font-data font-medium text-foreground">{page}</span> de{" "}
        <span className="font-data font-medium text-foreground">{totalPages}</span>
      </p>
      <Button variant="outline" size="sm" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
        <span className="max-[379px]:sr-only">Próxima</span>
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}
