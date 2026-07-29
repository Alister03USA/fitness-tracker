const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  if (!publicKey) {
    return Response.json(
      { error: "Missing VAPID_PUBLIC_KEY Supabase secret." },
      { headers: corsHeaders },
    );
  }

  return Response.json({ publicKey }, { headers: corsHeaders });
});
