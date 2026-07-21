const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const fields = "code,product_name,generic_name,brands,serving_size,nutriments";

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

    if (body.type === "barcode") {
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
        { status: 502, headers: corsHeaders },
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
      { status: 400, headers: corsHeaders },
    );
  }
});
