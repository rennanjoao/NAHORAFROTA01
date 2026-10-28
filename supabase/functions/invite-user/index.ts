import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { listAllUserEmails } from "../_shared/authUsers.ts";

interface InviteUserRequest {
  email: string;
  name: string;
  role: "admin" | "fleet_manager" | "dispatcher" | "viewer";
  password?: string; // Optional custom password
}

// Generate a random temporary password
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password + "!1";
}

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Configuração do servidor incompleta" }), { status: 500, headers: jsonHeaders });
    }

    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    // Create user client to check permissions
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401, headers: jsonHeaders });
    }

    const callerUserId = claimsData.claims.sub;

    // Only admins can invite
    const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: callerUserId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem convidar usuários" }), { status: 403, headers: jsonHeaders });
    }

    // Get caller's tenant_id
    const { data: callerProfile } = await userClient.from("profiles").select("tenant_id").eq("id", callerUserId).single();
    const tenantId = callerProfile?.tenant_id;

    // Parse request
    const body: InviteUserRequest = await req.json();
    const { email, name, role = "dispatcher", password: customPassword } = body;

    if (!email || !name) {
      return new Response(JSON.stringify({ error: "E-mail e nome são obrigatórios" }), { status: 400, headers: jsonHeaders });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Formato de e-mail inválido" }), { status: 400, headers: jsonHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if email already exists
    const emailExists = (await listAllUserEmails(adminClient)).has(email.toLowerCase().trim());

    if (emailExists) {
      return new Response(JSON.stringify({ error: "Este e-mail já está cadastrado no sistema" }), { status: 409, headers: jsonHeaders });
    }

    // Use custom password if provided, otherwise generate temp
    const tempPassword = customPassword?.trim() || generateTempPassword();

    // Create user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name, invited: true },
    });

    if (createError) {
      console.error("Create user error:", createError);
      return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: jsonHeaders });
    }

    const userId = newUser.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Erro ao criar usuário" }), { status: 500, headers: jsonHeaders });
    }

    // Assign role - use upsert to guarantee role exists
    const assignedRole = role || "dispatcher";
    await adminClient.from("user_roles").upsert(
      { user_id: userId, role: assignedRole, tenant_id: tenantId || null },
      { onConflict: "user_id,role" }
    );

    // If role is different from viewer, also remove any default viewer role created by trigger
    if (assignedRole !== "viewer") {
      await adminClient.from("user_roles").delete().eq("user_id", userId).eq("role", "viewer");
    }

    // Ensure profile exists (trigger may fail due to schema mismatch)
    await adminClient.from("profiles").upsert(
      { id: userId, email: email.toLowerCase().trim(), name, tenant_id: tenantId || null },
      { onConflict: "id" }
    );

    // Assign tenant membership if caller has tenant
    if (tenantId) {
      await adminClient.from("tenant_memberships").upsert(
        { tenant_id: tenantId, user_id: userId, role: role === "admin" ? "admin" : "member" },
        { onConflict: "tenant_id,user_id" }
      );
    }

    console.log(`✅ User invited: ${email} with role: ${role}, tenant: ${tenantId || "none"}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: userId, email, name, role },
        tempPassword,
        message: `Convite criado para ${email}`,
      }),
      { status: 201, headers: jsonHeaders }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), { status: 500, headers: jsonHeaders });
  }
});
