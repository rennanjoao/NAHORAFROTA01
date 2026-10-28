import { supabase } from "@/integrations/supabase/client";

export async function getCurrentTenantId(): Promise<string | null> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return null;

  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (membership?.tenant_id) return membership.tenant_id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();

  return profile?.tenant_id ?? null;
}

export async function requireCurrentTenantId(): Promise<string> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) {
    throw new Error("Usuário sem empresa vinculada. Faça login novamente ou revise o cadastro da empresa.");
  }

  return tenantId;
}
