/**
 * Mensagem de erro em portugues simples para mostrar na tela. Erros do banco,
 * de rede e de permissao chegam em ingles tecnico ("Failed to fetch",
 * "violates row-level security policy"); a pessoa precisa saber o que fazer.
 */
export function friendlyError(error: unknown, fallback = "Não foi possível concluir. Tente de novo."): string {
  const err = error as { message?: string; code?: string; status?: number } | null;
  const message = (err?.message || "").toLowerCase();
  if (typeof navigator !== "undefined" && !navigator.onLine) return "Sem internet. Confira a conexão e tente de novo.";
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/.test(message)) {
    return "Sem conexão com o servidor. Confira a internet e tente de novo.";
  }
  if (err?.code === "23505" || message.includes("duplicate key")) return "Já existe um cadastro com esses dados.";
  if (err?.code === "42501" || message.includes("row-level security") || message.includes("permission denied")) {
    return "Você não tem permissão para fazer isso.";
  }
  if (err?.code === "23503") return "Este item está ligado a outros registros e não pode ser alterado assim.";
  if (err?.code === "PGRST301" || message.includes("jwt") || err?.status === 401) return "Sua sessão expirou. Entre de novo.";
  // Mensagem ja em portugues (das nossas funções) pode ir direto.
  if (err?.message && /[ãçéêíóõú]|não|nao /i.test(err.message) && err.message.length < 160) return err.message;
  return fallback;
}
