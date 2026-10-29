const EVENTS = [
  ["06:58", "Romaneio #1042 saiu do pátio", "14 notas"],
  ["08:12", "ABC1D23 entregou em Osasco", "canhoto com foto"],
  ["08:40", "SLA do dia", "98% no prazo"],
  ["09:05", "Ocorrência registrada", "cliente ausente"],
  ["10:31", "GHI4J56 parado há 12 min", "alerta enviado"],
  ["11:20", "Importação de XML", "37 notas em lote"],
  ["12:02", "Acerto fechado", "R$ 1.240,00 · João"],
  ["13:45", "DEF7G89 em rota", "6 paradas restantes"],
  ["15:10", "Entrega confirmada com assinatura", "NF 48213"],
  ["17:30", "SLA da semana", "97,6% no prazo"],
];

/** Faixa de eventos de operação, em loop. Decorativa (texto equivalente para leitores de tela). */
export function Ticker() {
  const items = [...EVENTS, ...EVENTS];
  return (
    <div className="marquee relative overflow-hidden border-y border-border bg-card/60" aria-label="Exemplo de eventos de uma operação ao longo do dia">
      <p className="sr-only">
        Exemplos de eventos que o painel registra ao longo do dia: saída de romaneio, entregas com canhoto, SLA do dia, ocorrências, alertas de parada e acertos fechados.
      </p>
      <div aria-hidden="true" className="marquee-track flex w-max gap-10 py-3.5 pr-10" style={{ ["--marquee-duration" as string]: "70s" }}>
        {items.map(([t, msg, meta], i) => (
          <span key={i} className="flex shrink-0 items-center gap-3 font-data text-[13px] uppercase tracking-[0.06em]">
            <span className="text-brand">{t}</span>
            <span className="text-foreground/85">{msg}</span>
            <span className="text-muted-foreground">· {meta}</span>
            <span className="ml-4 h-1 w-1 rounded-full bg-brand/60" />
          </span>
        ))}
      </div>
    </div>
  );
}
