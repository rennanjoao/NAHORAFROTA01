import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal } from "../components/Reveal";

const QA = [
  ["Preciso instalar algum programa?", "Não. O painel roda no navegador (Chrome, Edge, Safari). No celular do motorista, o app instala pela tela inicial em um minuto, sem loja de aplicativos."],
  ["Como o motorista recebe o romaneio?", "O despachante monta o romaneio no painel e envia. O motorista abre o app, vê as entregas em ordem, navega até a próxima parada e registra o canhoto em cada uma."],
  ["Preciso de rastreador no veículo?", "Não. A posição vem do GPS do celular do motorista, a cada 30 segundos, enquanto o romaneio está em rota."],
  ["Funciona com agregados e frota própria?", "Sim. Cada romaneio define o tipo de frota. Frota própria não gera acerto; agregado gera frete, adiantamento e desconto, e o acerto fecha sozinho."],
  ["Como recebo o acesso depois de pagar?", "Na hora. Assim que o pagamento é confirmado, criamos a sua empresa e o seu usuário administrador e enviamos login e senha temporária por e-mail. A tela de confirmação também mostra o acesso, e você troca a senha no primeiro login."],
  ["Posso testar antes de assinar?", "Sim. O cadastro em “Testar grátis” libera 7 dias com todos os módulos, sem cartão. Quando quiser continuar, assine por aqui com o mesmo CNPJ e o mesmo e-mail: a empresa, os motoristas e as entregas ficam onde estão, e a assinatura passa a valer na hora."],
  ["Posso trocar de plano depois?", "Sim. O upgrade libera os módulos na hora. O downgrade vale a partir do próximo ciclo de cobrança."],
  ["Tem fidelidade ou multa?", "Não. A cobrança é mensal. Cancele quando quiser e o acesso continua até o fim do período já pago."],
  ["Meus dados ficam separados dos de outras empresas?", "Sim. Cada empresa tem o próprio espaço, com regras de acesso aplicadas no servidor. Um usuário só enxerga a empresa dele."],
];

export function FAQ() {
  return (
    <section id="duvidas" className="scroll-mt-nav border-t hairline py-24 lg:py-36" aria-labelledby="duvidas-title">
      <div className="container grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeader index="09" size="md" eyebrow="Dúvidas" title="O que perguntam antes de assinar." accent="antes de assinar." lead="Se a sua não está aqui, escreva para suporte@nahorafrota.com.br. Respondemos no mesmo dia útil." />
        </div>
        <Reveal>
          <Accordion type="single" collapsible className="border-t hairline">
            {QA.map(([q, a], i) => (
              <AccordionItem key={q} value={`q${i}`} className="border-b hairline">
                <AccordionTrigger className="gap-6 py-6 text-left font-heading text-lg font-semibold tracking-tight hover:no-underline sm:text-xl [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-brand">
                  <span className="flex items-baseline gap-4">
                    <span className="font-data text-xs text-muted-foreground">0{i + 1}</span>
                    {q}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-7 pl-9 text-base leading-relaxed text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
