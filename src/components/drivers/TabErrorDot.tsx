/** Ponto vermelho na aba que tem campo com erro (com texto para leitor de tela). */
export function TabErrorDot({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <>
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive animate-pop-in" />
      <span className="sr-only">(tem campo para corrigir)</span>
    </>
  );
}
