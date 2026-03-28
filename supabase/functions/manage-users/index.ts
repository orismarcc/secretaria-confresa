import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ---------------------------------------------------------------------------
// CORS — restrict to known origins; fallback to env var for production domain
// ---------------------------------------------------------------------------
const DEV_ORIGINS = ["http://localhost:8080", "http://localhost:5173", "http://localhost:3000"];
const PROD_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "";

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = PROD_ORIGIN
    ? [PROD_ORIGIN, ...DEV_ORIGINS]
    : DEV_ORIGINS;
  const allowedOrigin = allowed.includes(origin) ? origin : (allowed[0] ?? "");
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "false",
  };
}

// ---------------------------------------------------------------------------
// Safe error response — never expose internal details to clients
// ---------------------------------------------------------------------------
function errorResponse(
  cors: Record<string, string>,
  status: number,
  message: string,
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Input validation schemas
// ---------------------------------------------------------------------------
const createUserSchema = z.object({
  email: z.string().email("Email inválido").max(255, "Email muito longo"),
  password: z
    .string()
    .min(6, "Senha deve ter no mínimo 6 caracteres")
    .max(72, "Senha muito longa"),
  name: z
    .string()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(100, "Nome muito longo")
    .regex(/^[\p{L}\s'-]+$/u, "Nome contém caracteres inválidos"),
});

const updateUserSchema = z.object({
  userId: z.string().uuid("ID de usuário inválido"),
  name: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[\p{L}\s'-]+$/u)
    .optional(),
  is_active: z.boolean().optional(),
});

const deleteUserSchema = z.object({
  userId: z.string().uuid("ID de usuário inválido"),
});

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(cors, 401, "Não autorizado.");
    }

    const token = authHeader.slice(7); // "Bearer ".length === 7
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return errorResponse(cors, 401, "Token inválido.");
    }

    // Verify admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role, is_active")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData?.is_active) {
      return errorResponse(cors, 403, "Acesso negado.");
    }

    // -----------------------------------------------------------------------
    // Route by HTTP method
    // -----------------------------------------------------------------------
    const method = req.method;

    // --- POST: create operator ---
    if (method === "POST") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return errorResponse(cors, 400, "Corpo da requisição inválido.");
      }

      const parsed = createUserSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      const { email, password, name } = parsed.data;

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

      if (createError) {
        // Return safe message — never expose raw Supabase auth errors
        const msg = createError.message?.toLowerCase() ?? "";
        if (msg.includes("already registered") || msg.includes("already exists")) {
          return errorResponse(cors, 409, "Este email já está em uso.");
        }
        return errorResponse(cors, 400, "Não foi possível criar o usuário.");
      }

      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role: "operator", is_active: true });

      if (roleError) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        return errorResponse(cors, 500, "Erro interno ao criar operador.");
      }

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert({ id: newUser.user.id, email, name });

      if (profileError) {
        // Non-fatal — log internally only
        console.error("[manage-users] profile upsert failed for", newUser.user.id);
      }

      return new Response(
        JSON.stringify({
          user: {
            id: newUser.user.id,
            email: newUser.user.email,
            name: newUser.user.user_metadata?.name,
          },
        }),
        { status: 201, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // --- DELETE: remove operator ---
    if (method === "DELETE") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return errorResponse(cors, 400, "Corpo da requisição inválido.");
      }

      const parsed = deleteUserSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      const { userId } = parsed.data;

      if (userId === user.id) {
        return errorResponse(cors, 400, "Não é possível excluir sua própria conta.");
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) {
        return errorResponse(cors, 400, "Não foi possível excluir o usuário.");
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // --- PUT: update operator ---
    if (method === "PUT") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return errorResponse(cors, 400, "Corpo da requisição inválido.");
      }

      const parsed = updateUserSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      const { userId, name, is_active } = parsed.data;

      if (name !== undefined) {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: { name },
        });
        if (updateError) {
          return errorResponse(cors, 400, "Não foi possível atualizar o nome.");
        }
        await supabaseAdmin.from("profiles").update({ name }).eq("id", userId);
      }

      if (is_active !== undefined) {
        const { error: statusError } = await supabaseAdmin
          .from("user_roles")
          .update({ is_active })
          .eq("user_id", userId)
          .eq("role", "operator");

        if (statusError) {
          return errorResponse(cors, 400, "Não foi possível atualizar o status.");
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // --- GET: list operators ---
    if (method === "GET") {
      const { data: operators, error: listError } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role, created_at, is_active")
        .eq("role", "operator");

      if (listError) {
        return errorResponse(cors, 500, "Erro ao buscar operadores.");
      }

      const userIds = operators.map((op) => op.user_id);
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, name, email, created_at")
        .in("id", userIds);

      const operatorsWithProfiles = await Promise.all(
        operators.map(async (op) => {
          const profile = profiles?.find((p) => p.id === op.user_id);
          if (!profile || !profile.name || profile.name === "Sem nome") {
            const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(op.user_id);
            if (authUser?.user) {
              const name = authUser.user.user_metadata?.name || "Sem nome";
              const email = authUser.user.email || "";
              await supabaseAdmin
                .from("profiles")
                .upsert({ id: op.user_id, email, name });
              return {
                id: op.user_id,
                name,
                email,
                created_at: authUser.user.created_at || op.created_at,
                is_active: op.is_active,
              };
            }
          }
          return {
            id: op.user_id,
            name: profile?.name || "Sem nome",
            email: profile?.email || "",
            created_at: profile?.created_at || op.created_at,
            is_active: op.is_active,
          };
        }),
      );

      return new Response(JSON.stringify({ operators: operatorsWithProfiles }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return errorResponse(cors, 405, "Método não permitido.");
  } catch {
    // Never expose internal error details to the client
    return new Response(
      JSON.stringify({ error: "Erro interno no servidor. Tente novamente." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
