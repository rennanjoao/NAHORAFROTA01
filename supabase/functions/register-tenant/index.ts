import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface RegisterRequest {
  cnpj: string;
  razao_social: string;
  name: string;
  email: string;
  password: string;
}

function jsonResponse(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers });
}

function isValidCnpj(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14 || /^(\d)\1+$/.test(cleaned)) return false;

  const calc = (digits: string, weights: number[]) =>
    digits.split("").reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);

  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const firstDigit = ((rest) => (rest < 2 ? 0 : 11 - rest))(calc(cleaned.slice(0, 12), firstWeights) % 11);
  const secondDigit = ((rest) => (rest < 2 ? 0 : 11 - rest))(calc(cleaned.slice(0, 13), secondWeights) % 11);

  return Number(cleaned[12]) === firstDigit && Number(cleaned[13]) === secondDigit;
}

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Configuracao do servidor incompleta" }, 500, jsonHeaders);
    }

    const body: RegisterRequest = await req.json();
    const cnpj = body.cnpj || "";
    const razao_social = (body.razao_social || "").trim();
    const name = (body.name || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = (body.password || "").trim();

    if (!cnpj || !razao_social || !name || !email || !password) {
      return jsonResponse({ error: "Todos os campos sao obrigatorios" }, 400, jsonHeaders);
    }

    if (password.length < 8) {
      return jsonResponse({ error: "Senha deve ter ao menos 8 caracteres" }, 400, jsonHeaders);
    }

    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (!isValidCnpj(cleanCnpj)) {
      return jsonResponse({ error: "CNPJ invalido" }, 400, jsonHeaders);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: existingTenant, error: existingTenantError } = await adminClient
      .from("tenants")
      .select("id")
      .eq("cnpj", cleanCnpj)
      .maybeSingle();

    if (existingTenantError) {
      console.error("Tenant lookup error:", existingTenantError);
      return jsonResponse({ error: "Nao foi possivel validar o CNPJ" }, 500, jsonHeaders);
    }

    if (existingTenant) {
      return jsonResponse({ error: "CNPJ ja cadastrado no sistema" }, 409, jsonHeaders);
    }

    const { data: existingUsers, error: existingUsersError } = await adminClient.auth.admin.listUsers();
    if (existingUsersError) {
      console.error("Auth users lookup error:", existingUsersError);
      return jsonResponse({ error: "Nao foi possivel validar o e-mail" }, 500, jsonHeaders);
    }

    const emailExists = existingUsers?.users?.some((user) => user.email?.toLowerCase() === email);
    if (emailExists) {
      return jsonResponse({ error: "E-mail ja cadastrado no sistema" }, 409, jsonHeaders);
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createError || !newUser.user) {
      console.error("Create user error:", createError);
      return jsonResponse({ error: createError?.message || "Erro ao criar usuario" }, 400, jsonHeaders);
    }

    const userId = newUser.user.id;
    let tenantId: string | null = null;

    const rollback = async () => {
      if (tenantId) {
        await adminClient.from("tenant_memberships").delete().eq("tenant_id", tenantId);
        await adminClient.from("user_roles").delete().eq("tenant_id", tenantId);
        await adminClient.from("profiles").delete().eq("id", userId);
        await adminClient.from("tenants").delete().eq("id", tenantId);
      }
      await adminClient.auth.admin.deleteUser(userId);
    };

    const { data: tenant, error: tenantError } = await adminClient
      .from("tenants")
      .insert({
        name: razao_social,
        slug: `empresa-${cleanCnpj}`,
        document: cleanCnpj,
        email,
        cnpj: cleanCnpj,
        razao_social,
        status: "inactive",
        plan: "basic",
      })
      .select("id")
      .single();

    if (tenantError || !tenant) {
      console.error("Tenant creation error:", tenantError);
      await rollback();
      return jsonResponse({ error: tenantError?.message || "Erro ao registrar empresa" }, 500, jsonHeaders);
    }

    tenantId = tenant.id;

    const { error: profileError } = await adminClient.from("profiles").upsert(
      {
        id: userId,
        email,
        name,
        tenant_id: tenant.id,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      console.error("Profile creation error:", profileError);
      await rollback();
      return jsonResponse({ error: profileError.message || "Erro ao criar perfil do administrador" }, 500, jsonHeaders);
    }

    const { error: roleError } = await adminClient.from("user_roles").upsert(
      {
        user_id: userId,
        role: "admin",
        tenant_id: tenant.id,
      },
      { onConflict: "user_id,role" },
    );

    if (roleError) {
      console.error("Role creation error:", roleError);
      await rollback();
      return jsonResponse({ error: roleError.message || "Erro ao criar permissao do administrador" }, 500, jsonHeaders);
    }

    const { error: membershipError } = await adminClient.from("tenant_memberships").upsert(
      {
        tenant_id: tenant.id,
        user_id: userId,
        role: "admin",
      },
      { onConflict: "tenant_id,user_id" },
    );

    if (membershipError) {
      console.error("Membership creation error:", membershipError);
      await rollback();
      return jsonResponse({ error: membershipError.message || "Erro ao vincular administrador a empresa" }, 500, jsonHeaders);
    }

    console.log(`Tenant registered: ${razao_social} (${cleanCnpj}) - Status: inactive`);

    return jsonResponse(
      {
        success: true,
        message: "Empresa cadastrada com sucesso. Aguarde aprovacao.",
        tenant_id: tenant.id,
      },
      201,
      jsonHeaders,
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return jsonResponse({ error: "Erro interno do servidor" }, 500, jsonHeaders);
  }
});
