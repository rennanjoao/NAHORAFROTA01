import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

type AppRole = "admin" | "fleet_manager" | "dispatcher" | "viewer";

interface UpdateUserAccessRequest {
  userId: string;
  name?: string;
  email?: string;
  password?: string;
  role?: AppRole;
  driver?: {
    id?: string;
    cpf?: string;
    phone?: string;
    vehiclePlate?: string;
    vehicleType?: string;
    status?: string;
  };
}

const VALID_ROLES = new Set(["admin", "fleet_manager", "dispatcher", "viewer"]);
const VALID_DRIVER_STATUS = new Set(["active", "in_route", "inactive", "pending_approval"]);

function normalizeEmail(email?: string | null): string | null {
  const normalized = String(email || "").trim().toLowerCase();
  return normalized || null;
}

function normalizeDigits(value?: string | null): string | null {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || null;
}

function normalizeVehiclePlate(value?: string | null): string | null {
  const normalized = String(value || "").replace(/\s+/g, "").toUpperCase();
  return normalized || null;
}

function normalizeVehicleType(value?: string | null): string | null {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || null;
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
      return new Response(JSON.stringify({ error: "Configuracao do servidor incompleta" }), {
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
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    const callerUserId = claimsData?.claims?.sub;

    if (claimsError || !callerUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized - Sessao invalida" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: callerUserId,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem alterar acessos" }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    const body: UpdateUserAccessRequest = await req.json();
    const targetUserId = String(body.userId || "").trim();
    const normalizedEmail = normalizeEmail(body.email);
    const normalizedName = String(body.name || "").trim();
    const normalizedPassword = String(body.password || "").trim();

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "Usuario alvo e obrigatorio" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return new Response(JSON.stringify({ error: "Formato de e-mail invalido" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (normalizedPassword && normalizedPassword.length < 8) {
      return new Response(JSON.stringify({ error: "Senha deve ter pelo menos 8 caracteres" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (body.role && !VALID_ROLES.has(body.role)) {
      return new Response(JSON.stringify({ error: "Perfil de acesso invalido" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const { data: callerMembership } = await adminClient
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", callerUserId)
      .maybeSingle();

    const callerTenantId = callerMembership?.tenant_id || null;

    if (!callerTenantId) {
      return new Response(JSON.stringify({ error: "Administrador sem empresa vinculada" }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    const { data: targetMembership } = await adminClient
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("tenant_id", callerTenantId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    const { data: targetDriver } = await adminClient
      .from("drivers")
      .select("id, tenant_id, user_id, email")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const targetDriverTenantId = targetDriver?.tenant_id || null;
    const belongsToTenant =
      !!targetMembership ||
      targetDriverTenantId === callerTenantId ||
      (!targetDriverTenantId && !!targetDriver?.id);

    if (!belongsToTenant) {
      return new Response(JSON.stringify({ error: "Usuario nao pertence a sua empresa" }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    if (body.role) {
      if (targetUserId === callerUserId) {
        const { data: callerIsStillAdmin } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", callerUserId)
          .eq("role", body.role)
          .maybeSingle();
        if (!callerIsStillAdmin) {
          return new Response(JSON.stringify({ error: "Voce nao pode alterar o proprio nivel de acesso" }), {
            status: 400,
            headers: jsonHeaders,
          });
        }
      }

      const { data: targetIsAdmin } = await adminClient
        .from("user_roles")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("role", "admin")
        .maybeSingle();

      if (targetIsAdmin && body.role !== "admin") {
        const { data: tenantMembers } = await adminClient
          .from("tenant_memberships")
          .select("user_id")
          .eq("tenant_id", callerTenantId);
        const otherMemberIds = (tenantMembers || []).map((m) => m.user_id).filter((id) => id !== targetUserId);
        const { count: otherAdmins } = otherMemberIds.length
          ? await adminClient
              .from("user_roles")
              .select("id", { count: "exact", head: true })
              .eq("role", "admin")
              .in("user_id", otherMemberIds)
          : { count: 0 };
        if (!otherAdmins) {
          return new Response(JSON.stringify({ error: "A empresa precisa de pelo menos um Administrador" }), {
            status: 400,
            headers: jsonHeaders,
          });
        }
      }
    }

    const authUpdates: Record<string, unknown> = {};
    if (normalizedEmail) {
      authUpdates.email = normalizedEmail;
      authUpdates.email_confirm = true;
    }
    if (normalizedPassword) authUpdates.password = normalizedPassword;
    if (normalizedName) authUpdates.user_metadata = { name: normalizedName };

    if (Object.keys(authUpdates).length > 0) {
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(targetUserId, authUpdates);
      if (authUpdateError) {
        const message = String(authUpdateError.message || "");
        const duplicated =
          (authUpdateError as { code?: string }).code === "email_exists" || /already (been )?registered|already exists/i.test(message);
        return new Response(JSON.stringify({ error: duplicated ? "Este e-mail ja esta em uso" : message }), {
          status: duplicated ? 409 : 400,
          headers: jsonHeaders,
        });
      }
    }

    const profileUpdates: Record<string, unknown> = {};
    if (normalizedName) profileUpdates.name = normalizedName;
    if (normalizedEmail) profileUpdates.email = normalizedEmail;

    if (Object.keys(profileUpdates).length > 0) {
      await adminClient.from("profiles").upsert(
        {
          id: targetUserId,
          tenant_id: callerTenantId,
          ...profileUpdates,
        },
        { onConflict: "id" },
      );
    }

    if (body.role) {
      // Grava o novo papel antes de apagar os outros: se falhar, o usuario nao fica sem acesso.
      const { error: roleError } = await adminClient.from("user_roles").upsert(
        { user_id: targetUserId, role: body.role, tenant_id: callerTenantId },
        { onConflict: "user_id,role" },
      );
      if (roleError) {
        return new Response(JSON.stringify({ error: roleError.message }), {
          status: 400,
          headers: jsonHeaders,
        });
      }
      await adminClient.from("user_roles").delete().eq("user_id", targetUserId).neq("role", body.role);
    }

    if (!targetMembership) {
      await adminClient.from("tenant_memberships").upsert(
        { tenant_id: callerTenantId, user_id: targetUserId, role: "member" },
        { onConflict: "tenant_id,user_id" },
      );
    }

    const driver = body.driver;
    if (driver || targetDriver?.id) {
      const driverUpdates: Record<string, unknown> = {};
      if (normalizedName) driverUpdates.name = normalizedName;
      if (normalizedEmail) driverUpdates.email = normalizedEmail;

      const cpf = normalizeDigits(driver?.cpf);
      const phone = String(driver?.phone || "").trim();
      const vehiclePlate = normalizeVehiclePlate(driver?.vehiclePlate);
      const vehicleType = normalizeVehicleType(driver?.vehicleType);
      const status = String(driver?.status || "").trim();

      if (cpf) driverUpdates.cpf = cpf;
      if (phone) driverUpdates.phone = phone;
      if (vehiclePlate) driverUpdates.vehicle_plate = vehiclePlate;
      if (vehicleType) driverUpdates.vehicle_type = vehicleType;
      if (status) {
        if (!VALID_DRIVER_STATUS.has(status)) {
          return new Response(JSON.stringify({ error: "Status de motorista invalido" }), {
            status: 400,
            headers: jsonHeaders,
          });
        }
        driverUpdates.status = status;
      }

      if (Object.keys(driverUpdates).length > 0) {
        const driverId = driver?.id || targetDriver?.id;
        if (!driverId) {
          return new Response(JSON.stringify({ error: "Motorista nao encontrado" }), {
            status: 404,
            headers: jsonHeaders,
          });
        }

        const { error: driverUpdateError } = await adminClient
          .from("drivers")
          .update({ ...driverUpdates, tenant_id: callerTenantId })
          .eq("id", driverId);

        if (driverUpdateError) {
          return new Response(JSON.stringify({ error: driverUpdateError.message }), {
            status: 400,
            headers: jsonHeaders,
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
