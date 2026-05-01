import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function parseRequest(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function contentExtension(contentType: string | null) {
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  return "jpg";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await parseRequest(request);
    const playerId = String(payload.player_key || payload.player_id || "").trim();
    if (!playerId) throw new Error("Missing player_key");

    const supabase = adminClient();
    const { data: master, error } = await supabase
      .from("player_master")
      .select("player_id, headshot_url, headshot_storage_path, headshot_public_url")
      .eq("player_id", playerId)
      .maybeSingle();
    if (error) throw error;
    if (!master?.headshot_url && !master?.headshot_public_url) return json({ headshot_url: null });
    if (master.headshot_public_url) return json({ headshot_url: master.headshot_public_url });

    const response = await fetch(master.headshot_url);
    if (!response.ok) throw new Error(`Headshot download failed: ${response.status}`);

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const path = `players/${playerId}.${contentExtension(contentType)}`;
    const bytes = await response.arrayBuffer();
    const { error: uploadError } = await supabase.storage.from("headshots").upload(path, bytes, {
      contentType,
      upsert: true,
    });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("headshots").getPublicUrl(path);
    const publicUrl = data.publicUrl;

    const { error: updateError } = await supabase
      .from("player_master")
      .update({ headshot_storage_path: path, headshot_public_url: publicUrl })
      .eq("player_id", playerId);
    if (updateError) throw updateError;

    return json({ headshot_url: publicUrl, headshot_storage_path: path });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});

