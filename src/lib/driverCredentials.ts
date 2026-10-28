import { supabase } from "@/integrations/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CredentialsEmailReason = "no_contact_email" | "email_not_configured" | "provider_error" | "error";

export interface CredentialsEmailResult {
  sent: boolean;
  reason?: CredentialsEmailReason;
  recipient?: string;
  message?: string;
}

export function isValidContactEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/**
 * Salva o e-mail pessoal do motorista e envia para ele os dados do cadastro
 * (login, senha inicial e link do app) pela edge function send-driver-credentials.
 */
export async function sendDriverCredentialsEmail(params: {
  driverId: string;
  contactEmail: string;
  password?: string | null;
}): Promise<CredentialsEmailResult> {
  const contactEmail = params.contactEmail.trim().toLowerCase();
  if (!isValidContactEmail(contactEmail)) return { sent: false, reason: "no_contact_email" };

  const { error: updateError } = await supabase
    .from("drivers")
    .update({ contact_email: contactEmail })
    .eq("id", params.driverId);
  if (updateError) return { sent: false, reason: "error", message: updateError.message };

  const { data, error } = await supabase.functions.invoke("send-driver-credentials", {
    body: { driver_id: params.driverId, password: params.password || undefined },
  });
  if (error) return { sent: false, reason: "error", message: error.message };

  return (data as CredentialsEmailResult) ?? { sent: false, reason: "error" };
}

/** Mensagem para o toast apos a tentativa de envio (null = nada a dizer). */
export function describeCredentialsEmailResult(
  result: CredentialsEmailResult,
): { kind: "success" | "warning" | "error"; title: string; description: string } | null {
  if (result.sent) {
    return {
      kind: "success",
      title: "📧 Dados de acesso enviados",
      description: `O motorista recebeu o login e o link do app em ${result.recipient}.`,
    };
  }

  switch (result.reason) {
    case "no_contact_email":
      return null;
    case "email_not_configured":
      return {
        kind: "warning",
        title: "E-mail não enviado",
        description: "O envio de e-mails ainda não está configurado no servidor. Repasse o login ao motorista manualmente.",
      };
    default:
      return {
        kind: "error",
        title: "Falha ao enviar o e-mail",
        description: result.message || "O motorista foi cadastrado, mas o e-mail com os dados não pôde ser enviado.",
      };
  }
}
