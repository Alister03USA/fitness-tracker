import { supabase } from "../supabaseClient";

export async function analyzeFoodPhoto(imageFile) {
  const imageBase64 = await fileToDataUrl(imageFile);
  const { data, error } = await supabase.functions.invoke(
    "food-photo-identify",
    {
      body: {
        imageBase64,
        fileName: imageFile.name || "meal.jpg",
      },
    },
  );

  if (error) {
    throw new Error(error.message || "Food photo analysis failed.");
  }
  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the selected photo."));
    reader.readAsDataURL(file);
  });
}
