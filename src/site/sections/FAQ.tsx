import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Minus, Plus } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal } from "../components/Reveal";

const QA = [
  ["Preciso instalar algum programa?", "Não. O painel roda no navegador (Chrome, Edge, Safari). No celular do motorista, o app instala pela tela inicial em um minuto, sem loja de aplicativos."],
  ["Preciso de rastreador no veículo?", "Não. A posição vem do GPS do celular do motorista enquanto o romaneio está em rota. No Premium o mapa é em tempo real; no Standard, atualiza a cada 30 minutos."],
  ["Como recebo o acesso depois de pagar?", "Na hora. Assim que o pagamento é confirmado, criamos a sua empresa e o seu usuário administrador e enviamos login e senha temporária por e-mail. A tela de confirmação também mostra o acesso, e você troca a senha no primeiro login."],
  ["Posso testar antes de assinar?", "Sim. O cadastro em “Testar grátis” libera 7 dias com todos os módulos, sem cartão. Quando quiser continuar, assine por aqui com o mesmo CNPJ e o mesmo e-mail: a empresa, os motoristas e as entregas ficam onde estão."],
  ["Como o motorista recebe o romaneio?", "O despachante monta o romaneio no painel e envia. O motorista abre o app, vê as entregas em ordem, navega até a próxima parada e registra o canhoto em cada uma."],
  ["Funciona com agregados e frota própria?", "Sim. Cada romaneio define o tipo de frota, e o painel separa frota própria e de terceiros em todos os planos. O acerto financeiro em lote, com recibo, também vem em todos; o relatório de pagamento por motorista é do Premium."],
  ["Posso trocar de plano depois?", "Sim. O upgrade libera os módulos na hora. O downgrade vale a partir do próximo ciclo de cobrança."],
  ["E se eu tiver mais motoristas do que o plano inclui?", "O Basic inclui 3 motoristas, o Standard 15 e o Premium 50. Cada motorista além disso custa R$ 10 por mês. Fale com a gente para liberar."],
  ["Tem fidelidade ou multa?", "Não. A cobrança é mensal. Cancele quando quiser e o acesso continua até o fim do período já pago."],
];

export function FAQ() {
  return (
    <section id="duvidas" className="scroll-mt-nav py-24 lg:py-32" aria-labelledby="duvidas-title">
      <div className="container">
        <SectionHeader align="center" eyebrow="Dúvidas" title="O que perguntam antes de assinar." accent="antes de assinar." lead="Se a sua não está aqui, escreva para suporte@nahorafrota.com.br. Respondemos no mesmo dia útil." />
        <Reveal className="mx-auto mt-12 max-w-3xl lg:mt-16">
          <AccordionPrimitive.Root type="single" collapsible defaultValue="q0" className="space-y-3">
            {QA.map(([q, a], i) => (
              <AccordionPrimitive.Item key={q} value={`q${i}`} className="group rounded-2xl border border-foreground/10 bg-card shadow-sm transition-colors data-[state=open]:border-brand/50">
                <AccordionPrimitive.Header>
                  <AccordionPrimitive.Trigger className="flex w-full items-center justify-between gap-6 rounded-2xl px-6 py-5 text-left font-heading text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-lg">
                    {q}
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-foreground/15 transition-colors group-data-[state=open]:border-brand group-data-[state=open]:bg-brand group-data-[state=open]:text-nhf-ink">
                      <Plus className="h-4 w-4 group-data-[state=open]:hidden" />
                      <Minus className="hidden h-4 w-4 group-data-[state=open]:block" />
                    </span>
                  </AccordionPrimitive.Trigger>
                </AccordionPrimitive.Header>
                <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <p className="px-6 pb-6 text-[0.95rem] leading-relaxed text-muted-foreground">{a}</p>
                </AccordionPrimitive.Content>
              </AccordionPrimitive.Item>
            ))}
          </AccordionPrimitive.Root>
        </Reveal>
      </div>
    </section>
  );
}
