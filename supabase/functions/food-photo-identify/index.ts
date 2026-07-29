const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOGMEAL_URL = "https://api.logmeal.com/v2/image/segmentation/complete";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function dataUrlToFile(imageBase64: string, fileName = "meal.jpg") {
  const [metadata, base64] = imageBase64.split(",");
  if (!base64) throw new Error("Invalid image payload.");

  const mimeMatch = metadata.match(/data:(.*?);base64/);
  const contentType = mimeMatch?.[1] || "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], fileName, { type: contentType });
}

function confidenceLabel(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return "";

  const percent = numeric <= 1 ? numeric * 100 : numeric;
  return `${Math.round(percent)}% match`;
}

function normalizeCandidate(raw: any) {
  const name =
    raw?.name ||
    raw?.foodName ||
    raw?.food_name ||
    raw?.class_name ||
    raw?.recognition_results?.[0]?.name ||
    raw?.recognition_results?.[0]?.foodName ||
    raw?.recognition_results?.[0]?.food_name;

  if (!name) return null;

  const confidence =
    raw?.prob ||
    raw?.probability ||
    raw?.confidence ||
    raw?.score ||
    raw?.recognition_results?.[0]?.prob ||
    raw?.recognition_results?.[0]?.probability ||
    raw?.recognition_results?.[0]?.confidence;

  return {
    id: raw?.id || raw?.food_id || raw?.recognition_results?.[0]?.id || name,
    name,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
  };
}

function extractCandidates(data: any) {
  const buckets = [
    data?.recognition_results,
    data?.foodType,
    data?.segmentation_results,
    data?.results,
    data?.items,
  ].filter(Array.isArray);

  const candidates = buckets
    .flat()
    .flatMap((item: any) => {
      if (Array.isArray(item?.recognition_results)) {
        return item.recognition_results.map(normalizeCandidate);
      }
      return normalizeCandidate(item);
    })
    .filter(Boolean);

  const seen = new Set<string>();
  return candidates.filter((candidate: any) => {
    const key = String(candidate.name).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", candidates: [] });
  }

  const token =
    Deno.env.get("LOGMEAL_API_TOKEN") || Deno.env.get("LOGMEAL_API_KEY");

  if (!token) {
    return jsonResponse({
      error: "Missing LOGMEAL_API_TOKEN Supabase secret.",
      candidates: [],
    });
  }

  try {
    const { imageBase64, fileName } = await req.json();
    if (!imageBase64) throw new Error("Missing imageBase64.");

    const image = dataUrlToFile(String(imageBase64), fileName || "meal.jpg");
    const form = new FormData();
    form.append("image", image);

    const response = await fetch(LOGMEAL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(
        data?.message || data?.error || `LogMeal returned ${response.status}`,
      );
    }

    return jsonResponse({ candidates: extractCandidates(data) });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Food photo identification failed.";

    return jsonResponse({ error: message, candidates: [] });
  }
});
