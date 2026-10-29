/**
 * Mensagens das funcoes do servidor em portugues simples. Algumas vem sem
 * acento ("Voce nao pode...") ou em ingles (Supabase Auth): aqui viram uma
 * frase que diz o que aconteceu e o que fazer.
 */
const KNOWN: { test: RegExp; message: string }[] = [
  { test: /e-?mail.*(cadastrad|em uso|exist)|already (been )?registered|already exists/i, message: "Este e-mail já está cadastrado. Use outro e-mail." },
  { test: /proprio nivel|próprio nível/i, message: "Você não pode mudar o seu próprio nível de acesso." },
  { test: /pelo menos um administrador/i, message: "A empresa precisa de pelo menos um administrador." },
  { test: /nao pertence|não pertence/i, message: "Esta pessoa não faz parte da sua empresa." },
  { test: /unauthorized|sess[aã]o (inv[aá]lida|expirada)|jwt/i, message: "Sua sessão expirou. Entre de novo para continuar." },
  { test: /apenas (o )?administrador/i, message: "Só o administrador da empresa pode fazer isso." },
  { test: /senha deve ter|password should be at least/i, message: "A senha precisa ter pelo menos 8 caracteres." },
  { test: /formato de e-?mail|invalid email/i, message: "Confira o e-mail. Exemplo: nome@empresa.com.br" },
  { test: /failed to (send|fetch)|networkerror|servidor\. verifique a conex/i, message: "Sem conexão com o servidor. Confira a internet e tente de novo." },
  { test: /limite do plano|plan limit|limit reached/i, message: "O limite do plano foi atingido. Fale com a equipe para mudar de plano." },
];

/** Texto em ingles ou tecnico (sem acento nenhum e com termos de sistema). */
const looksTechnical = (message: string) =>
  /\b(the|is|not|invalid|error|failed|function|edge|status|code|null|undefined|violates|constraint)\b/i.test(message);

export function friendlyServerMessage(message: string | undefined | null, fallback: string): string {
  const text = (message || "").trim();
  if (!text) return fallback;
  const known = KNOWN.find((item) => item.test.test(text));
  if (known) return known.message;
  return looksTechnical(text) ? fallback : text;
}

/** O erro e de e-mail repetido? (mostrado embaixo do campo, nao em aviso solto) */
export const isDuplicateEmail = (message: string | undefined | null, code?: string) =>
  code === "email_exists" || /e-?mail.*(cadastrad|em uso|exist)|already (been )?registered|already exists/i.test(message || "");
