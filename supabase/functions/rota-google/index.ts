// Rota de visitas técnicas pelo Google (Routes API), com a ordem das paradas
// otimizada pelo próprio Google — o mesmo traçado do Google Maps.
//
// * A chave (GOOGLE_MAPS_API_KEY) fica só no servidor (secret do Supabase).
// * Só administradores ativos podem chamar.
// * Só coordenadas vão ao Google (nenhum nome/dado do produtor).
// * Sem a chave configurada responde 503 "nao_configurado" e o app usa o
//   cálculo alternativo (OpenStreetMap).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEV_ORIGINS = ["http://localhost:8080", "http://localhost:5173", "http://localhost:3000", "http://localhost:8091"];
const KNOWN_PROD_ORIGINS = ["https://secretaria-confresa-plum.vercel.app"];
const VERCEL_ORIGIN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;
const MAX_PARADAS = 25;

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const extra = (Deno.env.get("ALLOWED_ORIGIN") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const allowed = [...KNOWN_PROD_ORIGINS, ...extra, ...DEV_ORIGINS];
  const ok = allowed.includes(origin) || VERCEL_ORIGIN.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : KNOWN_PROD_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const json = (c: Record<string, string>, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...c, "Content-Type": "application/json" } });

interface LatLng { lat: number; lng: number }
const valido = (p: unknown): p is LatLng =>
  !!p && typeof (p as LatLng).lat === "number" && typeof (p as LatLng).lng === "number" &&
  Math.abs((p as LatLng).lat) <= 90 && Math.abs((p as LatLng).lng) <= 180;
const wp = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
const segundos = (d?: string) => (d ? Number(String(d).replace("s", "")) || 0 : 0);

Deno.serve(async (req) => {
  const c = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: c });
  if (req.method !== "POST") return json(c, 405, { error: "Método não permitido." });

  try {
    // --- Autenticação: admin ativo ---
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json(c, 401, { error: "Não autorizado." });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authErr } = await admin.auth.getUser(auth.slice(7));
    if (authErr || !user) return json(c, 401, { error: "Token inválido." });
    const { data: role } = await admin.from("user_roles").select("is_active")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!role?.is_active) return json(c, 403, { error: "Acesso negado." });

    const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!key) return json(c, 503, { error: "nao_configurado" });

    // --- Entrada ---
    const body = await req.json().catch(() => null);
    const origem = body?.origem;
    const paradas = body?.paradas;
    const voltar = body?.voltar !== false;
    const destinoIndice = Number.isInteger(body?.destinoIndice) ? body.destinoIndice : null;
    if (!valido(origem) || !Array.isArray(paradas) || paradas.length < 1 || paradas.length > MAX_PARADAS || !paradas.every(valido)) {
      return json(c, 400, { error: "Entrada inválida." });
    }
    if (!voltar && (destinoIndice == null || destinoIndice < 0 || destinoIndice >= paradas.length)) {
      return json(c, 400, { error: "Destino inválido." });
    }

    // Ida e volta: destino = origem, todas as paradas no meio.
    // Só ida: destino = parada indicada; as demais no meio.
    const meioIdx = voltar ? paradas.map((_: LatLng, i: number) => i) : paradas.map((_: LatLng, i: number) => i).filter((i: number) => i !== destinoIndice);
    const destino = voltar ? origem : paradas[destinoIndice!];

    const g = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.optimizedIntermediateWaypointIndex,routes.legs.duration,routes.legs.distanceMeters,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: wp(origem),
        destination: wp(destino),
        intermediates: meioIdx.map((i: number) => wp(paradas[i])),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        optimizeWaypointOrder: meioIdx.length > 1,
        languageCode: "pt-BR",
        units: "METRIC",
      }),
    });
    if (!g.ok) {
      console.error("Routes API", g.status, (await g.text()).slice(0, 500));
      return json(c, 502, { error: "google_falhou" });
    }
    const r = (await g.json())?.routes?.[0];
    if (!r) return json(c, 422, { error: "sem_rota" });

    const opt: number[] = Array.isArray(r.optimizedIntermediateWaypointIndex) && r.optimizedIntermediateWaypointIndex[0] !== -1
      ? r.optimizedIntermediateWaypointIndex
      : meioIdx.map((_: number, i: number) => i);
    const ordem = opt.map((k) => meioIdx[k]);
    if (!voltar) ordem.push(destinoIndice!);

    return json(c, 200, {
      ordem,
      trechos: (r.legs ?? []).map((l: { duration?: string; distanceMeters?: number }) => ({ segundos: segundos(l.duration), metros: l.distanceMeters ?? 0 })),
      polyline: r.polyline?.encodedPolyline ?? null,
    });
  } catch (e) {
    console.error("rota-google", e);
    return json(c, 500, { error: "Erro interno." });
  }
});
