import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { listAllUserEmails } from "../_shared/authUsers.ts";
import { detectDocumentType, isValidCnpj, onlyDigits } from "../_shared/documents.ts";

const TRIAL_DAYS = 7;

interface RegisterRequest {
  cnpj: string;
  razao_social: string;
  name: string;
  email: string;
  password: string;
  billing_document?: string;
  visitor_id?: string;
}

function jsonResponse(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers });
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

    const cleanCnpj = onlyDigits(cnpj);
    if (!isValidCnpj(cleanCnpj)) {
      return jsonResponse({ error: "CNPJ invalido" }, 400, jsonHeaders);
    }

    // Documento de cobranca: CPF ou CNPJ. Sem informar, a cobranca vai para o CNPJ da empresa.
    const billingDocument = onlyDigits(body.billing_document || "") || cleanCnpj;
    const billingDocumentType = detectDocumentType(billingDocument);
    if (!billingDocumentType) {
      return jsonResponse({ error: "CPF/CNPJ de cobranca invalido" }, 400, jsonHeaders);
    }

    const visitorId = /^[A-Za-z0-9_-]{8,64}$/.test(body.visitor_id || "") ? body.visitor_id! : null;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const documentsToLock = Array.from(new Set([cleanCnpj, billingDocument]));

    const [{ data: existingTenants, error: existingTenantError }, { data: usedTrials, error: usedTrialsError }] =
      await Promise.all([
        adminClient
          .from("tenants")
          .select("id, cnpj, billing_document")
          .or(`cnpj.eq.${cleanCnpj},billing_document.in.(${documentsToLock.join(",")})`),
        adminClient
          .from("trial_registrations")
          .select("document")
          .in("document", documentsToLock),
      ]);

    if (existingTenantError || usedTrialsError) {
      console.error("Tenant/trial lookup error:", existingTenantError || usedTrialsError);
      return jsonResponse({ error: "Nao foi possivel validar o CNPJ/CPF" }, 500, jsonHeaders);
    }

    if ((existingTenants || []).some((tenant) => onlyDigits(tenant.cnpj || "") === cleanCnpj)) {
      return jsonResponse({ error: "CNPJ ja cadastrado no sistema" }, 409, jsonHeaders);
    }

    // Um teste gratis por documento: nem a empresa nem o pagador podem repetir o trial.
    if ((existingTenants || []).length > 0 || (usedTrials || []).length > 0) {
      return jsonResponse(
        {
          error: "Este CNPJ/CPF ja utilizou o periodo de teste gratis. Fale com a equipe Na Hora Frota para contratar.",
          code: "trial_already_used",
        },
        409,
        jsonHeaders,
      );
    }

    let existingEmails: Set<string>;
    try {
      existingEmails = await listAllUserEmails(adminClient);
    } catch (existingUsersError) {
      console.error("Auth users lookup error:", existingUsersError);
      return jsonResponse({ error: "Nao foi possivel validar o e-mail" }, 500, jsonHeaders);
    }

    if (existingEmails.has(email)) {
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
        await adminClient.from("trial_registrations").delete().eq("tenant_id", tenantId);
        await adminClient.from("tenant_memberships").delete().eq("tenant_id", tenantId);
        await adminClient.from("user_roles").delete().eq("tenant_id", tenantId);
        await adminClient.from("profiles").delete().eq("id", userId);
        await adminClient.from("tenants").delete().eq("id", tenantId);
      }
      await adminClient.auth.admin.deleteUser(userId);
    };

    const trialStartedAt = new Date();
    const trialEndsAt = new Date(trialStartedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const { data: tenant, error: tenantError } = await adminClient
      .from("tenants")
      .insert({
        name: razao_social,
        slug: `empresa-${cleanCnpj}`,
        document: cleanCnpj,
        email,
        cnpj: cleanCnpj,
        razao_social,
        status: "trial",
        plan: "basic",
        trial_started_at: trialStartedAt.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        billing_document: billingDocument,
        billing_document_type: billingDocumentType,
        signup_visitor_id: visitorId,
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

    // handle_new_user cria um papel "viewer" para todo login novo; o administrador fica so com "admin".
    await adminClient.from("user_roles").delete().eq("user_id", userId).eq("role", "viewer");

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

    const { error: trialLockError } = await adminClient.from("trial_registrations").insert(
      documentsToLock.map((document) => ({
        document,
        document_type: document === cleanCnpj ? "cnpj" : billingDocumentType,
        tenant_id: tenant.id,
        email,
      })),
    );

    if (trialLockError) {
      console.error("Trial lock error:", trialLockError);
      await rollback();
      return jsonResponse({ error: "Nao foi possivel iniciar o periodo de teste" }, 500, jsonHeaders);
    }

    const { error: funnelError } = await adminClient.from("funnel_events").insert({
      visitor_id: visitorId || `tenant:${tenant.id}`,
      event: "register_completed",
      path: "/register",
      tenant_id: tenant.id,
      user_id: userId,
      metadata: { billing_document_type: billingDocumentType },
    });
    if (funnelError) console.error("Funnel event error (non-fatal):", funnelError);

    console.log(`Tenant registered: ${razao_social} (${cleanCnpj}) - Status: trial until ${trialEndsAt.toISOString()}`);

    return jsonResponse(
      {
        success: true,
        message: `Empresa cadastrada. Seu teste gratis de ${TRIAL_DAYS} dias ja comecou.`,
        tenant_id: tenant.id,
        trial_ends_at: trialEndsAt.toISOString(),
      },
      201,
      jsonHeaders,
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return jsonResponse({ error: "Erro interno do servidor" }, 500, jsonHeaders);
  }
});
