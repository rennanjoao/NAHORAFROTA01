import { Counter } from "../motion/Counter";
import { Stagger, StaggerItem } from "../components/Reveal";

const ITEMS = [
  { value: 30, suffix: " s", label: "entre uma posição e a próxima no mapa" },
  { value: 2, suffix: " min", label: "para importar as notas do dia pelo XML" },
  { value: 0, prefix: "R$ ", label: "de implantação. Sem fidelidade, sem multa" },
];

export function Numbers() {
  return (
    <section className="py-14 lg:py-16" aria-label="Números do produto">
      <div className="container">
        <Stagger className="grid gap-6 sm:grid-cols-3">
          {ITEMS.map((n) => (
            <StaggerItem key={n.label}>
              <div className="site-card p-6">
                <p className="font-data text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                  <Counter to={n.value} prefix={n.prefix} suffix={n.suffix} />
                </p>
                <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{n.label}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
