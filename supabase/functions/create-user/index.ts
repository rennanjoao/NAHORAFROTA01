import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
  cpf?: string;
  role?: "admin" | "fleet_manager" | "dispatcher" | "viewer";
}

function normalizeCpf(cpf?: string | null): string | null {
  const digits = String(cpf || "").replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

// Max attempts to find unique email
const MAX_EMAIL_ATTEMPTS = 10;

// Try to find a unique email by appending numbers
async function findUniqueEmail(
  adminClient: ReturnType<typeof createClient>,
  baseEmail: string
): Promise<{ email: string; attempts: number }> {
  // First try the base email
  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const existingEmails = new Set(existingUsers?.users?.map((u) => u.email?.toLowerCase()) || []);

  if (!existingEmails.has(baseEmail.toLowerCase())) {
    return { email: baseEmail, attempts: 0 };
  }

  // Parse email to add incremental number
  const [localPart, domain] = baseEmail.split("@");
  
  // Check if localPart already ends with a number (e.g., "pedro1")
  const match = localPart.match(/^(.+?)(\d+)?$/);
  const baseName = match?.[1] || localPart;

  for (let i = 1; i <= MAX_EMAIL_ATTEMPTS; i++) {
    const candidateEmail = `${baseName}${i}@${domain}`;
    if (!existingEmails.has(candidateEmail.toLowerCase())) {
      return { email: candidateEmail, attempts: i };
    }
  }

  throw new Error(`Não foi possível gerar email único após ${MAX_EMAIL_ATTEMPTS} tentativas`);
}

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized - Token ausente" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // Validate JWT / get claims (server-side)
    const token = authHeader.replace("Bearer ", "").trim();
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      console.error("Auth claims error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Sessão inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`User ${userId} requesting to create new user`);

    // Check if user has admin or fleet_manager role
    const { data: isAdmin, error: adminRoleError } = await userClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    const { data: isFleetManager, error: fmRoleError } = await userClient.rpc("has_role", {
      _user_id: userId,
      _role: "fleet_manager",
    });

    console.log(`Role check - isAdmin: ${isAdmin}, isFleetManager: ${isFleetManager}`);

    if ((adminRoleError && fmRoleError) || (!isAdmin && !isFleetManager)) {
      console.error("Role check failed - user is not admin or fleet_manager");
      return new Response(
        JSON.stringify({ error: "Apenas administradores e gestores de frota podem criar usuários" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: CreateUserRequest = await req.json();
    const { email, password, name, phone, cpf, role = "viewer" } = body;
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();
    const normalizedPhone = phone?.trim() || null;
    const normalizedCpf = normalizeCpf(cpf);

    console.log(`Creating user with email: ${normalizedEmail}, role: ${role}`);

    const allowedRoles = ["admin", "fleet_manager", "dispatcher", "viewer"];
    if (!allowedRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: "Nivel de acesso invalido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hierarquia: so o Administrador cria usuarios do painel. O Gestor de Frota
    // cria apenas logins de motorista (viewer).
    if (role !== "viewer" && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Apenas o Administrador pode criar usuarios do painel" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    if (!normalizedEmail || !password || !normalizedName) {
      return new Response(
        JSON.stringify({ error: "E-mail, senha e nome são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return new Response(
        JSON.stringify({ error: "Formato de e-mail inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Senha deve ter pelo menos 8 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client to create user (this won't log out the admin)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Pre-check: CPF must be unique (drivers.cpf has UNIQUE constraint)
    if (normalizedCpf) {
      const { data: existingDriver, error: cpfCheckError } = await adminClient
        .from("drivers")
        .select("id,name,cpf")
        .eq("cpf", normalizedCpf)
        .maybeSingle();

      if (cpfCheckError) {
        console.error("CPF check error:", cpfCheckError);
        return new Response(
          JSON.stringify({ error: "Não foi possível validar o CPF. Tente novamente." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (existingDriver?.id) {
        return new Response(
          JSON.stringify({
            error: `CPF já cadastrado para o motorista: ${existingDriver.name || existingDriver.id}`,
            code: "cpf_already_exists",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Try to find a unique email (auto-increment if exists)
    let finalEmail = normalizedEmail;
    let emailAttempts = 0;
    try {
      const uniqueResult = await findUniqueEmail(adminClient, normalizedEmail);
      finalEmail = uniqueResult.email;
      emailAttempts = uniqueResult.attempts;
      
      if (emailAttempts > 0) {
        console.log(`Email ${normalizedEmail} already exists, using ${finalEmail} instead`);
      }
    } catch (emailError) {
      console.error("Error finding unique email:", emailError);
      return new Response(
        JSON.stringify({ error: emailError instanceof Error ? emailError.message : "Erro ao gerar email único" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user with admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: finalEmail,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: normalizedName,
        phone: normalizedPhone,
        cpf: normalizedCpf,
      },
    });

    if (createError) {
      console.error("Create user error:", createError);
      let errorMessage = createError.message;
      if (errorMessage.includes("already been registered") || errorMessage.includes("email_exists")) {
        errorMessage = "Este e-mail já está cadastrado no sistema";
      }
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User created successfully: ${newUser.user?.id}`);

    // Assign role - use upsert to guarantee role exists even if trigger didn't fire
    if (newUser.user) {
      // Get caller's tenant_id to assign to the new user
      const { data: callerMembership } = await userClient
        .from("tenant_memberships")
        .select("tenant_id")
        .eq("user_id", userId)
        .maybeSingle();

      const callerTenantId = callerMembership?.tenant_id || null;

      // Upsert the role
      await adminClient.from("user_roles").upsert(
        { user_id: newUser.user.id, role, tenant_id: callerTenantId },
        { onConflict: "user_id,role" }
      );

      // Remove default viewer if assigning a different role
      if (role !== "viewer") {
        await adminClient.from("user_roles").delete()
          .eq("user_id", newUser.user.id).eq("role", "viewer");
      }

      // Ensure tenant membership exists
      if (callerTenantId) {
        await adminClient.from("tenant_memberships").upsert(
          { tenant_id: callerTenantId, user_id: newUser.user.id, role: "member" },
          { onConflict: "tenant_id,user_id" }
        );

        // Update profile with tenant_id
        await adminClient.from("profiles").upsert(
          { id: newUser.user.id, email: finalEmail, name: normalizedName, tenant_id: callerTenantId },
          { onConflict: "id" }
        );
      }
    }

    console.log(`✅ User created successfully: ${finalEmail} with role: ${role}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user?.id,
          email: finalEmail,
          originalEmail: normalizedEmail,
          emailChanged: emailAttempts > 0,
          name: normalizedName,
          role,
        },
        message: emailAttempts > 0 
          ? `Motorista criado com email ${finalEmail} (email original já existia)`
          : "Motorista criado com sucesso",
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...getCorsHeaders(null), "Content-Type": "application/json" } }
    );
  }
});
