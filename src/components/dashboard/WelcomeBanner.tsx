import { Sparkles } from "lucide-react";
export function WelcomeBanner() {
  return <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-muted/50 via-background to-muted/30 border border-border p-6 md:p-8">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative z-10 flex items-start gap-4">
        <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Olá! Bem-vindo à Torre de Controle Na Hora.</h1>
          <p className="mt-2 text-muted-foreground text-base md:text-lg">
            Aqui você tem total previsibilidade da sua operação. O que vamos fazer hoje?
          </p>
        </div>
      </div>
    </div>;
}