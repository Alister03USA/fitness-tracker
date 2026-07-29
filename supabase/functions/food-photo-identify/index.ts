const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOGMEAL_SEGMENT_URL =
  "https://api.logmeal.com/v2/image/segmentation/complete";
const LOGMEAL_NUTRITION_URL =
  "https://api.logmeal.com/v2/nutrition/recipe/nutritionalInfo";

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

function extractRecognizedName(data: any) {
  return (
    data?.segmentation_results?.[0]?.recognition_results?.[0]?.name ||
    data?.recognition_results?.[0]?.name ||
    (Array.isArray(data?.foodName) ? data.foodName[0] : data?.foodName) ||
    "Recognized meal"
  );
}

function nutrientValue(data: any, key: string) {
  return data?.nutritional_info?.totalNutrients?.[key]?.quantity ?? 0;
}

function parseNutrition(data: any, fallbackName: string) {
  const foodName = Array.isArray(data?.foodName) ? data.foodName[0] : data?.foodName;

  return {
    foodName: foodName || fallbackName,
    calories: Math.round(
      data?.nutritional_info?.calories ?? nutrientValue(data, "ENERC_KCAL"),
    ),
    proteinGrams: Math.round(nutrientValue(data, "PROCNT")),
    carbsGrams: Math.round(nutrientValue(data, "CHOCDF")),
    fatGrams: Math.round(nutrientValue(data, "FAT")),
    fiberGrams: Math.round(nutrientValue(data, "FIBTG")),
    sugarGrams: Math.round(nutrientValue(data, "SUGAR")),
    sodiumMg: Math.round(nutrientValue(data, "NA")),
  };
}

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
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

    const segmentResponse = await fetch(LOGMEAL_SEGMENT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    const segmentData = await readJson(segmentResponse);

    if (!segmentResponse.ok) {
      throw new Error(
        segmentData?.message ||
          segmentData?.error ||
          `LogMeal returned ${segmentResponse.status}`,
      );
    }

    const imageId = segmentData.imageId;
    if (!imageId) {
      throw new Error("LogMeal did not return an imageId for this photo.");
    }

    const recognizedName = extractRecognizedName(segmentData);
    const nutritionResponse = await fetch(LOGMEAL_NUTRITION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageId }),
    });

    const nutritionData = await readJson(nutritionResponse);

    if (!nutritionResponse.ok) {
      throw new Error(
        nutritionData?.message ||
          nutritionData?.error ||
          `LogMeal nutrition returned ${nutritionResponse.status}`,
      );
    }

    return jsonResponse({
      ...parseNutrition(nutritionData, recognizedName),
      candidates: extractCandidates(segmentData),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Food photo identification failed.";

    return jsonResponse({ error: message, candidates: [] });
  }
});
