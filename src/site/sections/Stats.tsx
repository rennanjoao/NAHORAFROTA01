import { Counter } from "../motion/Counter";
import { Stagger, StaggerItem } from "../components/Reveal";

const STATS = [
  { value: 30, suffix: " s", label: "entre uma posição e a próxima no mapa", line: "M0 24 C 20 22, 30 14, 50 16 S 80 6, 100 4" },
  { value: 2, suffix: " min", label: "para importar as notas do dia pelo XML", line: "M0 20 C 15 22, 30 10, 50 12 S 75 8, 100 6" },
  { value: 0, prefix: "R$ ", label: "de implantação. Sem fidelidade e sem multa", line: "M0 18 C 25 18, 35 16, 55 14 S 85 12, 100 10" },
];

/** Uma frase forte em cartao verde + tres fatos do produto com mini grafico. */
export function Stats() {
  return (
    <section className="pb-10 pt-4 lg:pb-16" aria-label="O Na Hora Frota em números">
      <div className="container">
        <Stagger className="grid gap-4 md:grid-cols-[1.3fr_1fr_1fr_1fr]" gap={0.07}>
          <StaggerItem>
            <div className="flex h-full flex-col justify-between rounded-2xl bg-brand p-7 text-nhf-ink shadow-[0_20px_50px_-24px_hsl(var(--brand)/0.9)]">
              <p className="label-caps text-nhf-ink/70">Sempre na hora</p>
              <p className="mt-6 text-balance font-heading text-2xl font-semibold leading-tight tracking-tight">Cada entrega com hora, foto e posição. Na mesma tela.</p>
            </div>
          </StaggerItem>
          {STATS.map((s) => (
            <StaggerItem key={s.label}>
              <div className="site-card flex h-full flex-col p-6">
                <p className="font-data text-4xl font-bold tracking-tight text-foreground">
                  <Counter to={s.value} prefix={s.prefix} suffix={s.suffix} />
                </p>
                <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{s.label}</p>
                <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="mt-auto h-8 w-full pt-3" aria-hidden="true">
                  <defs>
                    <linearGradient id={`fade-${s.value}`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="hsl(var(--brand))" stopOpacity="0.25" />
                      <stop offset="1" stopColor="hsl(var(--brand))" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${s.line} V28 H0 Z`} fill={`url(#fade-${s.value})`} />
                  <path d={s.line} fill="none" stroke="hsl(var(--brand))" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                </svg>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
