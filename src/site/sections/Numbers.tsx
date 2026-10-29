import { Counter } from "../motion/Counter";
import { Stagger, StaggerItem } from "../components/Reveal";

const ITEMS = [
  { value: 30, suffix: " s", label: "entre uma posição e a próxima no mapa" },
  { value: 2, suffix: " min", label: "para importar as notas do dia pelo XML" },
  { value: 0, prefix: "R$ ", label: "de implantação. Sem fidelidade, sem multa" },
  { value: 1, suffix: " login", label: "por pessoa. Motorista só vê o romaneio dele" },
];

/** Faixa de numeros do produto (fatos do sistema, nao promessas). */
export function Numbers() {
  return (
    <section className="border-t hairline py-16 lg:py-20" aria-label="Números do produto">
      <div className="container">
        <Stagger className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4" gap={0.08}>
          {ITEMS.map((n) => (
            <StaggerItem key={n.label}>
              <div className="border-l border-brand/60 pl-5">
                <p className="display font-data text-[clamp(2.6rem,5vw,4.2rem)] text-foreground">
                  <Counter to={n.value} prefix={n.prefix} suffix={n.suffix} />
                </p>
                <p className="mt-2 max-w-[220px] text-pretty text-sm leading-relaxed text-muted-foreground">{n.label}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
