import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { listAllUserEmails } from "../_shared/authUsers.ts";

interface CreateDriverRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
  cpf?: string;
  vehiclePlate?: string;
  vehicleType?: string;
}

function normalizeCpf(cpf?: string | null): string | null {
  const digits = String(cpf || "").replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

function formatCpf(cpf?: string | null): string | null {
  const digits = normalizeCpf(cpf);
  if (!digits || digits.length !== 11) return null;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function normalizeVehiclePlate(plate?: string | null): string | null {
  const normalized = String(plate || "").replace(/\s+/g, "").toUpperCase();
  return normalized || null;
}

const MAX_EMAIL_ATTEMPTS = 10;

async function findUniqueEmail(
  adminClient: ReturnType<typeof createClient>,
  baseEmail: string,
): Promise<{ email: string; attempts: number }> {
  const existingEmails = await listAllUserEmails(adminClient);

  if (!existingEmails.has(baseEmail.toLowerCase())) {
    return { email: baseEmail, attempts: 0 };
  }

  const [localPart, domain] = baseEmail.split("@");
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

async function rollbackUser(adminClient: ReturnType<typeof createClient>, userId: string) {
  await adminClient.from("drivers").delete().eq("user_id", userId);
  await adminClient.from("tenant_memberships").delete().eq("user_id", userId);
  await adminClient.from("user_roles").delete().eq("user_id", userId);
  await adminClient.from("profiles").delete().eq("id", userId);
  await adminClient.auth.admin.deleteUser(userId);
}

async function ensureUserAccess(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string | null,
  email: string,
  name: string,
) {
  await adminClient.from("user_roles").upsert(
    { user_id: userId, role: "viewer", tenant_id: tenantId },
    { onConflict: "user_id,role" },
  );

  if (tenantId) {
    await adminClient.from("tenant_memberships").upsert(
      { tenant_id: tenantId, user_id: userId, role: "member" },
      { onConflict: "tenant_id,user_id" },
    );
  }

  await adminClient.from("profiles").upsert(
    {
      id: userId,
      email,
      name,
      tenant_id: tenantId,
    },
    { onConflict: "id" },
  );
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
      return new Response(JSON.stringify({ error: "Configuração do servidor incompleta" }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized - Token ausente" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized - Sessão inválida" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const callerUserId = claimsData.claims.sub;

    const [{ data: isAdmin }, { data: isFleetManager }] = await Promise.all([
      userClient.rpc("has_role", { _user_id: callerUserId, _role: "admin" }),
      userClient.rpc("has_role", { _user_id: callerUserId, _role: "fleet_manager" }),
    ]);

    if (!isAdmin && !isFleetManager) {
      return new Response(
        JSON.stringify({ error: "Apenas administradores e gestores de frota podem criar motoristas" }),
        { status: 403, headers: jsonHeaders },
      );
    }

    const body: CreateDriverRequest = await req.json();
    const normalizedEmail = body.email.trim().toLowerCase();
    const normalizedName = body.name.trim();
    const normalizedPhone = body.phone?.trim() || null;
    const normalizedCpf = normalizeCpf(body.cpf);
    const formattedCpf = formatCpf(body.cpf);
    const normalizedVehiclePlate = normalizeVehiclePlate(body.vehiclePlate);
    const normalizedVehicleType = body.vehicleType?.trim().toLowerCase() || "van";

    if (!normalizedEmail || !body.password?.trim() || !normalizedName) {
      return new Response(JSON.stringify({ error: "E-mail, senha e nome são obrigatórios" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (body.password.trim().length < 8) {
      return new Response(JSON.stringify({ error: "Senha deve ter pelo menos 8 caracteres" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (!normalizedCpf || normalizedCpf.length !== 11) {
      return new Response(JSON.stringify({ error: "CPF deve conter 11 dígitos" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return new Response(JSON.stringify({ error: "Formato de e-mail inválido" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const [{ data: callerMembership }, { data: callerProfile }, cpfLookup] = await Promise.all([
      userClient.from("tenant_memberships").select("tenant_id").eq("user_id", callerUserId).maybeSingle(),
      userClient.from("profiles").select("tenant_id").eq("id", callerUserId).maybeSingle(),
      adminClient
        .from("drivers")
        .select("id,name,cpf,tenant_id,user_id,email,phone,vehicle_plate,vehicle_type,status")
        .or(`cpf.eq.${normalizedCpf}${formattedCpf ? `,cpf.eq.${formattedCpf}` : ""}`),
    ]);

    const callerTenantId = callerMembership?.tenant_id || callerProfile?.tenant_id || null;
    const existingDriver = cpfLookup.data?.find((driver) => normalizeCpf(driver.cpf) === normalizedCpf);

    if (cpfLookup.error) {
      return new Response(JSON.stringify({ error: "Não foi possível validar o CPF. Tente novamente." }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    if (
      existingDriver?.id &&
      existingDriver.tenant_id &&
      callerTenantId &&
      existingDriver.tenant_id !== callerTenantId
    ) {
      return new Response(
        JSON.stringify({
          error: `CPF já cadastrado para o motorista: ${existingDriver.name || existingDriver.id}`,
          code: "cpf_already_exists",
        }),
        { status: 409, headers: jsonHeaders },
      );
    }

    if (existingDriver?.id) {
      let userId = existingDriver.user_id;
      let finalEmail = existingDriver.email || normalizedEmail;
      let emailChanged = false;
      let createdUserId: string | null = null;

      try {
        if (!userId) {
          const uniqueEmailResult = await findUniqueEmail(adminClient, normalizedEmail);
          finalEmail = uniqueEmailResult.email;
          emailChanged = uniqueEmailResult.attempts > 0;

          const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email: finalEmail,
            password: body.password.trim(),
            email_confirm: true,
            user_metadata: {
              name: normalizedName,
              phone: normalizedPhone,
              cpf: normalizedCpf,
              tenant_id: callerTenantId,
            },
          });

          if (createError || !newUser.user?.id) {
            throw new Error(createError?.message || "Erro ao criar usuário de autenticação");
          }

          userId = newUser.user.id;
          createdUserId = newUser.user.id;
        }

        await ensureUserAccess(adminClient, userId, callerTenantId, finalEmail, normalizedName);

        const { data: updatedDriver, error: updateError } = await adminClient
          .from("drivers")
          .update({
            user_id: userId,
            tenant_id: callerTenantId || existingDriver.tenant_id,
            name: normalizedName,
            email: finalEmail,
            phone: normalizedPhone || existingDriver.phone || "00000000000",
            cpf: normalizedCpf,
            vehicle_plate: normalizedVehiclePlate || existingDriver.vehicle_plate || "PENDENTE",
            vehicle_type: normalizedVehicleType || existingDriver.vehicle_type || "van",
            status: existingDriver.status || "active",
          })
          .eq("id", existingDriver.id)
          .select("id,tenant_id,user_id")
          .single();

        if (updateError || !updatedDriver?.id) {
          throw new Error(updateError?.message || "Erro ao atualizar motorista existente");
        }

        return new Response(
          JSON.stringify({
            success: true,
            updated: true,
            user: {
              id: userId,
              email: finalEmail,
              originalEmail: normalizedEmail,
              emailChanged,
              name: normalizedName,
              role: "viewer",
            },
            driver: {
              id: updatedDriver.id,
              cpf: normalizedCpf,
              tenant_id: updatedDriver.tenant_id,
            },
            message: "Motorista existente atualizado com sucesso",
          }),
          { status: 200, headers: jsonHeaders },
        );
      } catch (error) {
        if (createdUserId) {
          await rollbackUser(adminClient, createdUserId);
        }

        return new Response(
          JSON.stringify({
            error: error instanceof Error ? error.message : "Erro ao atualizar motorista",
          }),
          { status: 400, headers: jsonHeaders },
        );
      }
    }

    let createdUserId: string | null = null;

    try {
      const uniqueEmailResult = await findUniqueEmail(adminClient, normalizedEmail);
      const finalEmail = uniqueEmailResult.email;
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: finalEmail,
        password: body.password.trim(),
        email_confirm: true,
        user_metadata: {
          name: normalizedName,
          phone: normalizedPhone,
          cpf: normalizedCpf,
          tenant_id: callerTenantId,
        },
      });

      if (createError || !newUser.user?.id) {
        return new Response(
          JSON.stringify({ error: createError?.message || "Erro ao criar usuário de autenticação" }),
          { status: 400, headers: jsonHeaders },
        );
      }

      createdUserId = newUser.user.id;

      await ensureUserAccess(adminClient, createdUserId, callerTenantId, finalEmail, normalizedName);

      const { data: driverRecord, error: driverError } = await adminClient
        .from("drivers")
        .insert({
          user_id: createdUserId,
          name: normalizedName,
          email: finalEmail,
          phone: normalizedPhone || "00000000000",
          cpf: normalizedCpf,
          vehicle_plate: normalizedVehiclePlate || "PENDENTE",
          vehicle_type: normalizedVehicleType,
          status: "active",
          avatar: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
          cnh: "00000000000",
          cnh_category: "B",
          individual_sla: 100,
          deliveries_completed: 0,
          total_deliveries: 0,
          current_delay: 0,
          tenant_id: callerTenantId,
        })
        .select("id")
        .single();

      if (driverError || !driverRecord?.id) {
        throw new Error(driverError?.message || "Erro ao criar perfil de motorista");
      }

      return new Response(
        JSON.stringify({
          success: true,
          updated: false,
          user: {
            id: createdUserId,
            email: finalEmail,
            originalEmail: normalizedEmail,
            emailChanged: uniqueEmailResult.attempts > 0,
            name: normalizedName,
            role: "viewer",
          },
          driver: {
            id: driverRecord.id,
            cpf: normalizedCpf,
            tenant_id: callerTenantId,
          },
          message:
            uniqueEmailResult.attempts > 0
              ? `Motorista criado com email ${finalEmail} (email original já existia)`
              : "Motorista criado com sucesso",
        }),
        { status: 201, headers: jsonHeaders },
      );
    } catch (error) {
      if (createdUserId) {
        await rollbackUser(adminClient, createdUserId);
      }

      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Erro ao criar motorista",
        }),
        { status: 400, headers: jsonHeaders },
      );
    }
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
