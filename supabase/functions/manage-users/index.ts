import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if requesting user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Unauthorized - Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const method = req.method;

    if (method === "POST") {
      // Create new operator
      const { email, password, name } = await req.json();

      if (!email || !password || !name) {
        return new Response(JSON.stringify({ error: "Email, password and name are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create user with admin API
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Assign operator role with is_active = true
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role: "operator", is_active: true });

      if (roleError) {
        // Rollback: delete user if role assignment fails
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        return new Response(JSON.stringify({ error: "Failed to assign role" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ 
        user: { 
          id: newUser.user.id, 
          email: newUser.user.email,
          name: newUser.user.user_metadata?.name 
        } 
      }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "DELETE") {
      const { userId } = await req.json();

      if (!userId) {
        return new Response(JSON.stringify({ error: "User ID is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent admin from deleting themselves
      if (userId === user.id) {
        return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete user (cascades to profiles and user_roles)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "PUT") {
      // Update operator name or status
      const { userId, name, is_active } = await req.json();

      if (!userId) {
        return new Response(JSON.stringify({ error: "User ID is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update user metadata if name provided
      if (name !== undefined) {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: { name },
        });

        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Also update profiles table
        await supabaseAdmin
          .from("profiles")
          .update({ name })
          .eq("id", userId);
      }

      // Update is_active status if provided
      if (is_active !== undefined) {
        const { error: statusError } = await supabaseAdmin
          .from("user_roles")
          .update({ is_active })
          .eq("user_id", userId)
          .eq("role", "operator");

        if (statusError) {
          return new Response(JSON.stringify({ error: statusError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET") {
      // List all operators
      const { data: operators, error: listError } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role, created_at, is_active")
        .eq("role", "operator");

      if (listError) {
        return new Response(JSON.stringify({ error: listError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get profiles for all operators
      const userIds = operators.map(op => op.user_id);
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, name, email, created_at")
        .in("id", userIds);

      const operatorsWithProfiles = operators.map(op => {
        const profile = profiles?.find(p => p.id === op.user_id);
        return {
          id: op.user_id,
          name: profile?.name || "Sem nome",
          email: profile?.email || "",
          created_at: profile?.created_at || op.created_at,
          is_active: op.is_active,
        };
      });

      return new Response(JSON.stringify({ operators: operatorsWithProfiles }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const error = err as Error;
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
