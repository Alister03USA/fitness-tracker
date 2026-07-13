const LOGMEAL_TOKEN = import.meta.env.VITE_LOGMEAL_API_TOKEN || "";
const BASE_URL = "https://api.logmeal.com/v2";

export async function analyzeFoodPhoto(imageFile) {
  if (!LOGMEAL_TOKEN) {
    throw new Error(
      "Missing VITE_LOGMEAL_API_TOKEN — add your LogMeal APIUser token to .env",
    );
  }

  // 1. Recognize the dish
  const formData = new FormData();
  formData.append("image", imageFile);

  const segRes = await fetch(`${BASE_URL}/image/segmentation/complete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOGMEAL_TOKEN}` },
    body: formData,
  });

  if (!segRes.ok) {
    throw new Error(`Food recognition failed (${segRes.status})`);
  }

  const segData = await segRes.json();
  console.log("[LogMeal] segmentation response:", segData);

  const imageId = segData.imageId;
  if (!imageId) {
    throw new Error("LogMeal didn't return an imageId for this photo");
  }

  const recognizedName = extractRecognizedName(segData);

  // 2. Fetch nutrition for that imageId (uses the top prediction by default)
  const nutRes = await fetch(`${BASE_URL}/nutrition/recipe/nutritionalInfo`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOGMEAL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageId }),
  });

  if (!nutRes.ok) {
    throw new Error(`Nutrition lookup failed (${nutRes.status})`);
  }

  const nutData = await nutRes.json();
  console.log("[LogMeal] nutritionalInfo response:", nutData);

  return parseNutritionalInfo(nutData, recognizedName);
}

function extractRecognizedName(segData) {
  return (
    segData?.segmentation_results?.[0]?.recognition_results?.[0]?.name ||
    (Array.isArray(segData?.foodName)
      ? segData.foodName[0]
      : segData?.foodName) ||
    "Recognized meal"
  );
}

function parseNutritionalInfo(data, fallbackName) {
  const totals = data?.nutritional_info?.totalNutrients || {};
  const get = (key) => totals?.[key]?.quantity ?? 0;

  const foodName = Array.isArray(data?.foodName)
    ? data.foodName[0]
    : data?.foodName;

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
