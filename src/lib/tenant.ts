import { supabase } from "@/integrations/supabase/client";

/*
 * Empresa do usuario logado.
 *
 * Antes cada tela/bloco perguntava ao servidor "quem e o usuario?" (auth.getUser, uma
 * chamada de rede) e depois "qual a empresa dele?" (tenant_memberships), a cada vez:
 * so a tela Inicio fazia isso 7 vezes, em fila, antes de buscar os proprios dados.
 * Agora o usuario sai da sessao local (sem rede) e a empresa e lembrada por usuario
 * ate a sessao mudar. A seguranca continua no banco (RLS); isso so escolhe o filtro.
 */
let cached: { userId: string; promise: Promise<string | null> } | null = null;

supabase.auth.onAuthStateChange((_event, session) => {
  if (!session?.user || (cached && cached.userId !== session.user.id)) cached = null;
});

/** Id do usuario logado, lido da sessao local (sem ida ao servidor). */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

async function lookupTenantId(userId: string): Promise<string | null> {
  // Erro de rede/servidor sobe como erro: se virasse "sem empresa", as telas
  // esvaziavam as listas como se nao houvesse dados.
  const { data: membership, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (membershipError) throw membershipError;

  if (membership?.tenant_id) return membership.tenant_id;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;

  return profile?.tenant_id ?? null;
}

export async function getCurrentTenantId(): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  if (cached?.userId === userId) return cached.promise;

  const promise = lookupTenantId(userId);
  cached = { userId, promise };
  // Erro ou "sem empresa" nao ficam guardados: a proxima chamada tenta de novo.
  promise.then(
    (id) => { if (!id && cached?.promise === promise) cached = null; },
    () => { if (cached?.promise === promise) cached = null; },
  );
  return promise;
}

export async function requireCurrentTenantId(): Promise<string> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) {
    throw new Error("Usuário sem empresa vinculada. Faça login novamente ou revise o cadastro da empresa.");
  }

  return tenantId;
}
