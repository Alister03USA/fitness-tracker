/**
 * LogMeal food recognition + nutrition lookup.
 * Docs: https://docs.logmeal.com
 *
 * Two-call flow (this is how LogMeal's API is structured — unlike a single
 * Gemini prompt, recognition and nutrition are separate endpoints):
 *   1. POST /v2/image/segmentation/complete  → upload the photo, get back
 *      an `imageId` plus the recognized dish(es).
 *   2. POST /v2/nutrition/recipe/nutritionalInfo  → pass that `imageId`,
 *      get back calories + a nutrient breakdown for the top-predicted dish.
 *
 * NOTE ON THE RESPONSE PARSER BELOW: LogMeal's interactive docs render
 * their example JSON client-side, so I could confirm the exact request
 * shape (verified against their reference docs) but not scrape a literal
 * example response body. The parser follows LogMeal's documented pattern —
 * `foodName`, and `nutritional_info.totalNutrients` keyed by INFOODS-style
 * tags (ENERC_KCAL, PROCNT, CHOCDF, FAT, FIBTG, SUGAR, NA). If your first
 * real call comes back with different field names, check the console for
 * the raw response and adjust `parseNutritionalInfo` below.
 */

const LOGMEAL_TOKEN = import.meta.env.VITE_LOGMEAL_API_TOKEN || "";
const BASE_URL = "https://api.logmeal.com/v2";

export async function analyzeFoodPhoto(imageFile) {
  if (!LOGMEAL_TOKEN) {
    throw new Error(
      "Missing VITE_LOGMEAL_API_TOKEN — add your LogMeal APIUser token to .env (and to Vercel's env vars if deployed).",
    );
  }

  let segRes;
  try {
    const formData = new FormData();
    formData.append("image", imageFile);

    segRes = await fetch(`${BASE_URL}/image/segmentation/complete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOGMEAL_TOKEN}` },
      body: formData,
    });
  } catch (networkErr) {
    // fetch() itself threw — this is almost always a CORS block or no
    // network connectivity, not a LogMeal-side error. A CORS block means
    // the browser never even got a response to inspect.
    console.error("[LogMeal] network/CORS error on segmentation call:", networkErr);
    throw new Error(
      "Couldn't reach LogMeal — this is usually a CORS block (their API may not allow direct browser calls) or a network issue. Check the browser console/Network tab for the real error.",
    );
  }

  if (!segRes.ok) {
    const bodyText = await safeReadBody(segRes);
    console.error(`[LogMeal] segmentation failed (${segRes.status}):`, bodyText);
    if (segRes.status === 413) {
      throw new Error(
        "That photo is still too large for LogMeal even after compression. Try a different photo, or check the console — resizing may not be running.",
      );
    }
    throw new Error(`Food recognition failed (${segRes.status}): ${bodyText}`);
  }

  const segData = await segRes.json();
  console.log("[LogMeal] segmentation response:", segData);

  const imageId = segData.imageId;
  if (!imageId) {
    console.error("[LogMeal] no imageId in response:", segData);
    throw new Error("LogMeal didn't return an imageId for this photo — see console for the raw response.");
  }

  const recognizedName = extractRecognizedName(segData);

  let nutRes;
  try {
    nutRes = await fetch(`${BASE_URL}/nutrition/recipe/nutritionalInfo`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOGMEAL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageId }),
    });
  } catch (networkErr) {
    console.error("[LogMeal] network/CORS error on nutrition call:", networkErr);
    throw new Error(
      "Couldn't reach LogMeal's nutrition endpoint — likely CORS or a network issue. Check the browser console/Network tab.",
    );
  }

  if (!nutRes.ok) {
    const bodyText = await safeReadBody(nutRes);
    console.error(`[LogMeal] nutritionalInfo failed (${nutRes.status}):`, bodyText);
    throw new Error(`Nutrition lookup failed (${nutRes.status}): ${bodyText}`);
  }

  const nutData = await nutRes.json();
  console.log("[LogMeal] nutritionalInfo response:", nutData);

  return parseNutritionalInfo(nutData, recognizedName);
}

async function safeReadBody(res) {
  try {
    const json = await res.clone().json();
    return JSON.stringify(json);
  } catch {
    try {
      return await res.text();
    } catch {
      return "(no response body)";
    }
  }
}

function extractRecognizedName(segData) {
  return (
    segData?.segmentation_results?.[0]?.recognition_results?.[0]?.name ||
    (Array.isArray(segData?.foodName) ? segData.foodName[0] : segData?.foodName) ||
    "Recognized meal"
  );
}

function parseNutritionalInfo(data, fallbackName) {
  const totals = data?.nutritional_info?.totalNutrients || {};
  const get = (key) => totals?.[key]?.quantity ?? 0;

  const foodName = Array.isArray(data?.foodName) ? data.foodName[0] : data?.foodName;

  return {
    foodName: foodName || fallbackName,
    calories: Math.round(data?.nutritional_info?.calories ?? get("ENERC_KCAL")),
    proteinGrams: Math.round(get("PROCNT")),
    carbsGrams: Math.round(get("CHOCDF")),
    fatGrams: Math.round(get("FAT")),
    fiberGrams: Math.round(get("FIBTG")),
    sugarGrams: Math.round(get("SUGAR")),
    sodiumMg: Math.round(get("NA")),
  };
}