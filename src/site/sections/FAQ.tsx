import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal } from "../components/Reveal";

const QA = [
  ["Preciso instalar algum programa?", "Não. O painel roda no navegador (Chrome, Edge, Safari). No celular do motorista, o app instala pela tela inicial em um minuto, sem loja de aplicativos."],
  ["Como o motorista recebe o romaneio?", "O despachante monta o romaneio no painel e envia. O motorista abre o app, vê as entregas em ordem, navega até a próxima parada e registra o canhoto em cada uma."],
  ["Preciso de rastreador no veículo?", "Não. A posição vem do GPS do celular do motorista, a cada 30 segundos, enquanto o romaneio está em rota."],
  ["Funciona com agregados e frota própria?", "Sim. Cada romaneio define o tipo de frota. Frota própria não gera acerto; agregado gera frete, adiantamento e desconto, e o acerto fecha sozinho."],
  ["Como recebo o acesso depois de pagar?", "Na hora. Assim que o pagamento é confirmado, criamos a sua empresa e o seu usuário administrador e enviamos login e senha temporária por e-mail. A tela de confirmação também mostra o acesso, e você troca a senha no primeiro login."],
  ["Posso trocar de plano depois?", "Sim. O upgrade libera os módulos na hora. O downgrade vale a partir do próximo ciclo de cobrança."],
  ["Tem fidelidade ou multa?", "Não. A cobrança é mensal. Cancele quando quiser e o acesso continua até o fim do período já pago."],
  ["Meus dados ficam separados dos de outras empresas?", "Sim. Cada empresa tem o próprio espaço, com regras de acesso aplicadas no servidor. Um usuário só enxerga a empresa dele."],
];

export function FAQ() {
  return (
    <section id="duvidas" className="scroll-mt-nav border-t border-border py-20 lg:py-28" aria-labelledby="duvidas-title">
      <div className="container grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <SectionHeader eyebrow="Dúvidas" title="O que perguntam antes de assinar." accent="antes de assinar." lead="Se a sua não está aqui, escreva para suporte@nahorafrota.com.br. Respondemos no mesmo dia útil." />
        <Reveal delay={0.1}>
          <Accordion type="single" collapsible className="rounded border border-border bg-card px-5">
            {QA.map(([q, a], i) => (
              <AccordionItem key={q} value={`q-${i}`} className="border-border">
                <AccordionTrigger className="py-5 text-left font-heading text-base font-semibold hover:no-underline hover:text-brand [&[data-state=open]]:text-brand">
                  {q}
                </AccordionTrigger>
                <AccordionContent className="text-pretty pb-5 text-[15px] leading-relaxed text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
