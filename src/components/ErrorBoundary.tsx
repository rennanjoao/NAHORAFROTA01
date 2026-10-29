import { Component, createRef, ErrorInfo, ReactNode } from "react";
import { RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  /** Erro no app inteiro (fora de um <main>): a tela de erro ocupa a pagina. */
  standalone: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  private fallbackRef = createRef<HTMLDivElement>();
  private headingRef = createRef<HTMLHeadingElement>();

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, standalone: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  // O erro pode acontecer ja na primeira montagem (didMount) ou depois (didUpdate).
  componentDidMount() {
    this.syncStandalone();
  }

  componentDidUpdate() {
    this.syncStandalone();
  }

  private syncStandalone() {
    if (!this.state.hasError || !this.fallbackRef.current) return;
    const standalone = !this.fallbackRef.current.parentElement?.closest("main, [role=main]");
    if (standalone !== this.state.standalone) this.setState({ standalone });
    // O que tinha foco sumiu com a tela que quebrou: leva o foco para o aviso.
    const active = document.activeElement;
    if (!active || active === document.body || !this.fallbackRef.current.contains(active)) {
      this.headingRef.current?.focus({ preventScroll: true });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { standalone, error } = this.state;
      return (
        <div
          ref={this.fallbackRef}
          role={standalone ? "main" : undefined}
          className={`flex items-center justify-center bg-background px-4 py-12 ${standalone ? "min-h-dvh" : "min-h-[60vh]"}`}
        >
          <div role="alert" className="w-full max-w-md animate-fade-in rounded-2xl border bg-card p-6 text-center shadow-lg sm:p-8">
            <span
              aria-hidden="true"
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-warning/30 bg-warning/10 text-warning"
            >
              <TriangleAlert className="h-7 w-7" />
            </span>
            <h1 ref={this.headingRef} tabIndex={-1} className="text-xl font-semibold text-foreground outline-none">
              {this.props.fallbackMessage || "Algo deu errado"}
            </h1>
            <p className="mt-2 text-[0.9375rem] text-muted-foreground">
              Esta tela teve um problema para abrir. Tente de novo. Se continuar, recarregue a página ou fale com o suporte.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={this.handleRetry} size="lg">
                <RotateCcw aria-hidden="true" />
                Tentar de novo
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline" size="lg">
                <RefreshCw aria-hidden="true" />
                Recarregar a página
              </Button>
            </div>
            {error?.message && (
              <details className="mt-6 text-left text-sm">
                <summary className="cursor-pointer rounded-md py-1 font-medium text-muted-foreground hover:text-foreground">
                  Detalhes para o suporte
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 font-mono text-xs text-foreground">
                  {error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
