const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const fields = "code,product_name,generic_name,brands,serving_size,nutriments";
const USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";

function nutrientValue(food: any, matchers: Array<string | number>) {
  const nutrients = food.foodNutrients || [];
  const found = nutrients.find((nutrient: any) => {
    const unit = String(nutrient.unitName || nutrient.unit || "").toLowerCase();
    if (matchers.includes("energy") && unit && unit !== "kcal") return false;

    const keys = [
      nutrient.nutrientId,
      nutrient.nutrientNumber,
      nutrient.number,
      nutrient.nutrientName,
      nutrient.name,
    ].map((value) => String(value || "").toLowerCase());

    return matchers.some((matcher) => {
      const normalized = String(matcher).toLowerCase();
      return keys.some((key) => key === normalized || key.includes(normalized));
    });
  });

  const amount = found?.value ?? found?.amount ?? 0;
  const unit = String(found?.unitName || found?.unit || "").toLowerCase();
  if (unit === "g" && matchers.includes("sodium")) return amount * 1000;
  return amount;
}

function servingLabel(food: any) {
  if (food.householdServingFullText) return food.householdServingFullText;
  if (food.servingSize && food.servingSizeUnit) {
    return `${food.servingSize} ${food.servingSizeUnit}`;
  }
  return "100 g";
}

function normalizeUsdaFood(food: any) {
  const name = food.description || food.lowercaseDescription || "USDA food";
  const brand = food.brandOwner || food.brandName || "";

  return {
    id: food.fdcId || `${name}-${brand}`,
    name,
    brand,
    dataType: food.dataType || "",
    serving: servingLabel(food),
    calories: Math.round(nutrientValue(food, [1008, "208", "energy"])),
    protein: Math.round(nutrientValue(food, [1003, "203", "protein"])),
    carbs: Math.round(
      nutrientValue(food, [1005, "205", "carbohydrate, by difference"]),
    ),
    fat: Math.round(nutrientValue(food, [1004, "204", "total lipid"])),
    fiber: Math.round(
      nutrientValue(food, [1079, "291", "fiber, total dietary"]),
    ),
    sugar: Math.round(nutrientValue(food, [2000, "269", "sugars"])),
    sodium: Math.round(nutrientValue(food, [1093, "307", "sodium"])),
  };
}

function rankUsdaFoods(foods: any[], query: string) {
  return foods
    .map((food: any) => ({
      food: normalizeUsdaFood(food),
      score: usdaScore(food, query),
    }))
    .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name))
    .map(({ food }) => food);
}

function usdaScore(food: any, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  const name = normalizeSearchText(food.description || food.lowercaseDescription);
  const brand = normalizeSearchText(food.brandOwner || food.brandName);
  const combined = `${name} ${brand}`.trim();
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  let score = 0;

  if (name === normalizedQuery) score += 90;
  if (name.startsWith(normalizedQuery)) score += 60;
  if (name.includes(normalizedQuery)) score += 40;
  if (tokens.length > 0 && tokens.every((token) => combined.includes(token))) {
    score += 35;
  }
  if (brand && tokens.some((token) => brand.includes(token))) score += 20;
  if (food.dataType === "Branded") score += 18;
  if (food.dataType === "Survey (FNDDS)") score += 8;
  if (food.dataType === "Foundation") score += 3;

  return score;
}

function normalizeSearchText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function searchUsdaFoods(query: string) {
  const apiKey =
    Deno.env.get("USDA_FDC_API_KEY") ||
    Deno.env.get("FDC_API_KEY") ||
    "DEMO_KEY";
  const params = new URLSearchParams({ api_key: apiKey });

  const response = await fetch(`${USDA_SEARCH_URL}?${params.toString()}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      pageSize: 25,
      dataType: ["Branded", "Survey (FNDDS)", "Foundation", "SR Legacy"],
    }),
  });

  if (!response.ok) {
    throw new Error("USDA food search is temporarily unavailable.");
  }

  const data = await response.json();
  return rankUsdaFoods(data.foods || [], query).slice(0, 8);
}

function normalizeProduct(product: any) {
  const nutriments = product.nutriments || {};
  const name = product.product_name || product.generic_name || "Packaged food";

  return {
    id: product.code || `${name}-${product.brands || ""}`,
    name,
    brand: product.brands || "",
    serving: product.serving_size || "",
    calories: Math.round(
      nutriments["energy-kcal_serving"] || nutriments["energy-kcal_100g"] || 0,
    ),
    protein: Math.round(
      nutriments.proteins_serving || nutriments.proteins_100g || 0,
    ),
    carbs: Math.round(
      nutriments.carbohydrates_serving || nutriments.carbohydrates_100g || 0,
    ),
    fat: Math.round(nutriments.fat_serving || nutriments.fat_100g || 0),
    fiber: Math.round(nutriments.fiber_serving || nutriments.fiber_100g || 0),
    sugar: Math.round(nutriments.sugars_serving || nutriments.sugars_100g || 0),
    sodium: Math.round(
      (nutriments.sodium_serving || nutriments.sodium_100g || 0) * 1000,
    ),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: corsHeaders },
    );
  }

  try {
    const body = await req.json();
    let url = "";

    if (body.source === "usda") {
      const query = String(body.query || "").trim();
      if (!query) throw new Error("Missing search query.");
      const products = await searchUsdaFoods(query);
      return Response.json(
        { source: "usda", products },
        { headers: corsHeaders },
      );
    } else if (body.type === "barcode") {
      const barcode = String(body.barcode || "").trim();
      if (!barcode) throw new Error("Missing barcode.");
      url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
        barcode,
      )}.json?fields=${encodeURIComponent(fields)}`;
    } else {
      const query = String(body.query || "").trim();
      if (!query) throw new Error("Missing search query.");
      const params = new URLSearchParams({
        search_terms: query,
        page_size: "8",
        fields,
      });
      url = `https://world.openfoodfacts.org/api/v2/search?${params.toString()}`;
    }

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "FitnessTracker/1.0 (contact: local-dev)",
      },
    });

    if (!response.ok) {
      return Response.json(
        { error: "Food lookup is temporarily unavailable.", products: [] },
        { headers: corsHeaders },
      );
    }

    const data = await response.json();
    const rawProducts =
      body.type === "barcode"
        ? data.status === 1 && data.product
          ? [data.product]
          : []
        : data.products || [];

    const products = rawProducts
      .filter((product: any) => product.product_name || product.generic_name)
      .map(normalizeProduct);

    return Response.json({ products }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      { error: error.message || "Food lookup failed.", products: [] },
      { headers: corsHeaders },
    );
  }
});
