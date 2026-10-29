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
        Anterior
      </Button>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Página <span className="font-data font-medium text-foreground">{page}</span> de{" "}
        <span className="font-data font-medium text-foreground">{totalPages}</span>
      </p>
      <Button variant="outline" size="sm" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
        Próxima
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}
