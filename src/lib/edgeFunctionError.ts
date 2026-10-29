export interface EdgeFunctionErrorInfo {
  message: string;
  status?: number;
  code?: string;
}

/**
 * Mensagem real de erro de uma edge function. Em respostas fora de 2xx o
 * supabase-js guarda a Response em error.context; sem ler o corpo a tela so
 * mostrava "Edge Function returned a non-2xx status code".
 */
export async function readEdgeFunctionError(error: unknown, fallback: string): Promise<EdgeFunctionErrorInfo> {
  const anyError = error as { message?: string; status?: number; context?: unknown } | null;
  const context = anyError?.context;
  let status = anyError?.status;

  try {
    if (context instanceof Response) {
      status = context.status;
      const text = await context.clone().text();
      try {
        const payload = JSON.parse(text);
        return {
          message: String(payload?.error || payload?.message || fallback),
          status,
          code: payload?.code ? String(payload.code) : undefined,
        };
      } catch {
        return { message: text || fallback, status };
      }
    }
  } catch {
    // Corpo ilegivel: cai na mensagem generica abaixo.
  }

  const message = anyError?.message || "";
  if (/Failed to send a request|Failed to fetch|NetworkError/i.test(message)) {
    return { message: "Não foi possível falar com o servidor. Verifique a conexão e tente novamente.", status };
  }
  return { message: message && !/non-2xx/i.test(message) ? message : fallback, status };
}

/** Parte local de e-mail sem acentos nem caracteres invalidos ("João" -> "joao"). */
export function toEmailLocalPart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
