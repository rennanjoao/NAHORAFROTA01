import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAGE_SIZE = 1000;

/**
 * E-mails (minusculos) de todos os logins do projeto.
 * auth.admin.listUsers() devolve so a primeira pagina (50 por padrao), entao a
 * checagem de e-mail duplicado deixava passar quase todos os cadastros.
 */
export async function listAllUserEmails(adminClient: SupabaseClient): Promise<Set<string>> {
  const emails = new Set<string>();
  for (let page = 1; ; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const user of users) {
      if (user.email) emails.add(user.email.toLowerCase());
    }
    if (users.length < PAGE_SIZE) break;
  }
  return emails;
}
