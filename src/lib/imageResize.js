/**
 * Resize + re-compress an image file before uploading it anywhere.
 * Phone camera photos are routinely 3000-4000px wide and several MB —
 * way more resolution than a food-recognition model needs, and often
 * over an API's upload size limit (this is what caused LogMeal's 413s).
 *
 * LogMeal doesn't publish an exact size limit, so instead of guessing one
 * fixed quality setting, this actively shrinks in steps (both dimensions
 * and JPEG quality) until the result is under `targetBytes`, or it runs
 * out of steps to try. Logs before/after size to the console so it's easy
 * to verify in devtools that this is actually working.
 */

const STEPS = [
  { maxDimension: 1280, quality: 0.82 },
  { maxDimension: 1024, quality: 0.75 },
  { maxDimension: 800, quality: 0.65 },
  { maxDimension: 640, quality: 0.55 },
];

export async function resizeImageFile(file, targetBytes = 900 * 1024) {
  console.log(
    `[imageResize] original size: ${(file.size / 1024).toFixed(0)}KB`,
  );

  let result = file;

  for (const step of STEPS) {
    result = await compressOnce(file, step.maxDimension, step.quality);
    console.log(
      `[imageResize] tried ${step.maxDimension}px @ q${step.quality} → ${(result.size / 1024).toFixed(0)}KB`,
    );
    if (result.size <= targetBytes) {
      break;
    }
  }

  console.log(`[imageResize] final size: ${(result.size / 1024).toFixed(0)}KB`);
  return result;
}

function compressOnce(file, maxDimension, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to compress image"));
            return;
          }
          resolve(
            new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
              type: "image/jpeg",
            }),
          );
        },
        "image/jpeg",
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image for resizing"));
    };

    img.src = objectUrl;
  });
}
