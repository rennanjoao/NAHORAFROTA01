import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal } from "../components/Reveal";

const QA = [
  ["Preciso instalar algum programa?", "Não. O painel roda no navegador (Chrome, Edge, Safari). No celular do motorista, o app instala pela tela inicial em um minuto, sem loja de aplicativos."],
  ["Como o motorista recebe o romaneio?", "O despachante monta o romaneio no painel e envia. O motorista abre o app, vê as entregas em ordem, navega até a próxima parada e registra o canhoto em cada uma."],
  ["Preciso de rastreador no veículo?", "Não. A posição vem do GPS do celular do motorista, a cada 30 segundos, enquanto o romaneio está em rota."],
  ["Funciona com agregados e frota própria?", "Sim. Cada romaneio define o tipo de frota. Frota própria não gera acerto; agregado gera frete, adiantamento e desconto, e o acerto fecha sozinho."],
  ["Como recebo o acesso depois de pagar?", "Na hora. Assim que o pagamento é confirmado, criamos a sua empresa e o seu usuário administrador e enviamos login e senha temporária por e-mail. A tela de confirmação também mostra o acesso, e você troca a senha no primeiro login."],
  ["Posso testar antes de assinar?", "Sim. O cadastro em “Testar grátis” libera 7 dias com todos os módulos, sem cartão. Quando quiser continuar, assine por aqui com o mesmo CNPJ e o mesmo e-mail: a empresa, os motoristas e as entregas ficam onde estão."],
  ["Posso trocar de plano depois?", "Sim. O upgrade libera os módulos na hora. O downgrade vale a partir do próximo ciclo de cobrança."],
  ["Tem fidelidade ou multa?", "Não. A cobrança é mensal. Cancele quando quiser e o acesso continua até o fim do período já pago."],
];

export function FAQ() {
  return (
    <section id="duvidas" className="scroll-mt-nav py-20 lg:py-28" aria-labelledby="duvidas-title">
      <div className="container">
        <SectionHeader align="center" eyebrow="Dúvidas" title="O que perguntam antes de assinar." accent="antes de assinar." lead="Se a sua não está aqui, escreva para suporte@nahorafrota.com.br. Respondemos no mesmo dia útil." />
        <Reveal className="mx-auto mt-10 max-w-3xl">
          <Accordion type="single" collapsible className="site-card divide-y divide-foreground/10 px-6">
            {QA.map(([q, a], i) => (
              <AccordionItem key={q} value={`q${i}`} className="border-0">
                <AccordionTrigger className="py-5 text-left font-heading text-base font-semibold hover:no-underline sm:text-lg [&>svg]:text-brand">{q}</AccordionTrigger>
                <AccordionContent className="pb-5 text-base leading-relaxed text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
