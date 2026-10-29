import { useEffect } from "react";
import { SiteLayout } from "../SiteLayout";

const SUPPORT_EMAIL = "suporte@nahorafrota.com.br";

const CONTENT = {
  termos: {
    title: "Termos de uso",
    updated: "29 de outubro de 2026",
    sections: [
      ["O serviço", "O Na Hora Frota é um painel de gestão de entregas e frota oferecido por assinatura mensal. O contratante (empresa identificada pelo CNPJ informado na compra) recebe um usuário administrador e pode criar outros usuários e motoristas dentro dos limites do plano."],
      ["Assinatura e cobrança", "A cobrança é mensal, no cartão de crédito, no valor do plano escolhido. Não há fidelidade nem taxa de implantação. O cancelamento pode ser feito a qualquer momento e o acesso continua até o fim do período já pago. Mudanças de plano para cima valem na hora; para baixo, no próximo ciclo."],
      ["Responsabilidades", "O contratante é responsável pelos dados que cadastra (clientes, endereços, valores, motoristas) e por manter as senhas da equipe em sigilo. O Na Hora Frota é responsável por manter o serviço disponível, com os dados isolados por empresa, e por avisar com antecedência sobre manutenções programadas."],
      ["Disponibilidade", "Trabalhamos para manter o serviço no ar 24 horas por dia. Em caso de indisponibilidade prolongada por falha nossa, o período é compensado na mensalidade seguinte."],
      ["Encerramento", "Ao cancelar, os dados ficam disponíveis para exportação por 30 dias e depois são apagados, salvo obrigação legal de guarda."],
      ["Contato", `Dúvidas sobre estes termos: ${SUPPORT_EMAIL}.`],
    ],
  },
  privacidade: {
    title: "Política de privacidade",
    updated: "29 de outubro de 2026",
    sections: [
      ["O que coletamos", "Na compra: razão social, CNPJ, nome, e-mail e WhatsApp do administrador. No uso: dados operacionais que a empresa cadastra (notas fiscais, endereços de entrega, motoristas, veículos, posições de GPS durante a rota, fotos e assinaturas de comprovante)."],
      ["Para que usamos", "Para operar o serviço contratado: criar o acesso, enviar login e senha, processar a cobrança, mostrar o mapa, calcular SLA e acerto. Não vendemos dados e não enviamos propaganda para os contatos cadastrados."],
      ["Com quem compartilhamos", "Com os provedores necessários para o serviço funcionar: processamento de pagamento (Stripe), banco de dados e autenticação (Supabase) e envio de e-mail transacional. Cada um recebe só o que precisa para a sua função."],
      ["Posição dos motoristas", "A posição do celular é enviada apenas enquanto um romaneio está em rota no app do motorista e fica visível somente para a empresa dele."],
      ["Seus direitos (LGPD)", "O contratante pode pedir a exportação ou a exclusão dos dados da empresa a qualquer momento pelo e-mail de suporte. Titulares (motoristas, destinatários) podem exercer seus direitos pelo mesmo canal; encaminhamos à empresa responsável quando for o caso."],
      ["Segurança", "Conexão HTTPS, isolamento de dados por empresa aplicado no banco, senha individual por usuário com troca obrigatória no primeiro acesso e armazenamento privado para fotos e assinaturas."],
      ["Contato", `Encarregado de dados: ${SUPPORT_EMAIL}.`],
    ],
  },
} as const;

export default function LegalPage({ kind }: { kind: keyof typeof CONTENT }) {
  const c = CONTENT[kind];
  useEffect(() => {
    document.title = `${c.title} — Na Hora Frota`;
    window.scrollTo({ top: 0 });
  }, [c.title]);
  return (
    <SiteLayout>
      <article className="container max-w-3xl pb-24 pt-32">
        <p className="label-caps text-brand">Atualizado em {c.updated}</p>
        <h1 className="mt-3 font-heading text-4xl font-bold">{c.title}</h1>
        <div className="prose-sm mt-10 space-y-8">
          {c.sections.map(([h, p]) => (
            <section key={h}>
              <h2 className="font-heading text-xl font-bold">{h}</h2>
              <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">{p}</p>
            </section>
          ))}
        </div>
      </article>
    </SiteLayout>
  );
}
