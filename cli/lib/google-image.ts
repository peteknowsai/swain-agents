/**
 * google-image.ts
 *
 * Generate images via Google Gemini API (Nano Banana 2 / Gemini 3.1 Flash Image)
 * and upload to Cloudflare Images.
 *
 * Replaces replicate-image.ts — same public interface, no polling needed.
 *
 * Env vars required:
 *   GEMINI_API_KEY              — Google AI API key
 *   CLOUDFLARE_ACCOUNT_ID      — Cloudflare account ID
 *   CLOUDFLARE_IMAGES_API_TOKEN — Cloudflare Images API token
 */

const GEMINI_MODEL = "gemini-3.1-flash-image-preview";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const CF_DELIVERY_HASH = process.env.CLOUDFLARE_DELIVERY_HASH || "7NA-8FN5mTUANBxov63ekA";
const CF_DELIVERY_BASE = `https://imagedelivery.net/${CF_DELIVERY_HASH}`;

export interface ImageResult {
  url: string;        // Cloudflare delivery URL
  imageId: string;    // Cloudflare image ID
  generationId: string;
}

// Keep backwards compat for callers that reference the old type
export type ReplicateImageResult = ImageResult;

/**
 * Check that all required env vars are set.
 */
function checkEnv(): {
  geminiKey: string;
  cfAccountId: string;
  cfImagesToken: string;
} {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!cfAccountId) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is not set.");
  }

  const cfImagesToken = process.env.CLOUDFLARE_IMAGES_API_TOKEN;
  if (!cfImagesToken) {
    throw new Error("CLOUDFLARE_IMAGES_API_TOKEN is not set.");
  }

  return { geminiKey, cfAccountId, cfImagesToken };
}

/**
 * Call Gemini image generation API. Synchronous — no polling.
 * Returns raw image bytes as an ArrayBuffer.
 */
async function runGemini(
  prompt: string,
  geminiKey: string,
  imageInputBase64?: string,
  aspectRatio?: string,
  resolution?: string,
): Promise<{ imageBytes: ArrayBuffer; mimeType: string }> {
  // Build content parts
  const parts: any[] = [];

  // For image-to-image: source image goes before the text prompt
  if (imageInputBase64) {
    parts.push({
      inline_data: {
        mime_type: "image/jpeg",
        data: imageInputBase64,
      },
    });
  }

  parts.push({ text: prompt });

  // Build image config
  const imageConfig: Record<string, string> = {};
  if (aspectRatio && aspectRatio !== "match_input_image") {
    imageConfig.aspectRatio = aspectRatio;
  }
  if (resolution) {
    imageConfig.imageSize = resolution;
  }

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: Object.keys(imageConfig).length > 0 ? imageConfig : undefined,
    },
  };

  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${geminiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API failed [${res.status}]: ${errText}`);
  }

  const json = await res.json() as any;

  // Extract image from response
  const candidates = json.candidates;
  if (!candidates?.length) {
    const blockReason = json.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`Gemini blocked prompt: ${blockReason}`);
    }
    throw new Error(`Gemini returned no candidates: ${JSON.stringify(json).slice(0, 200)}`);
  }

  const content = candidates[0].content;
  if (!content?.parts?.length) {
    throw new Error(`Gemini candidate has no parts: ${JSON.stringify(candidates[0]).slice(0, 200)}`);
  }

  // Find the image part
  const imagePart = content.parts.find((p: any) => p.inlineData?.data);
  if (!imagePart) {
    throw new Error(`Gemini response contains no image data`);
  }

  const base64Data = imagePart.inlineData.data;
  const mimeType = imagePart.inlineData.mimeType || "image/png";

  // Decode base64 to bytes
  const imageBytes = Buffer.from(base64Data, "base64").buffer;

  return { imageBytes, mimeType };
}

/**
 * Upload raw image bytes to Cloudflare Images.
 */
async function uploadToCloudflare(
  imageData: ArrayBuffer,
  mimeType: string,
  cfAccountId: string,
  cfImagesToken: string,
): Promise<{ url: string; imageId: string }> {
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/images/v1`;
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([imageData], { type: mimeType }),
    `image.${ext}`,
  );

  const cfRes = await fetch(cfUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfImagesToken}` },
    body: formData,
  });

  if (!cfRes.ok) {
    const errText = await cfRes.text();
    throw new Error(`Cloudflare Images upload failed [${cfRes.status}]: ${errText}`);
  }

  const cfJson = (await cfRes.json()) as {
    success: boolean;
    result?: { id: string; variants: string[] };
    errors?: { message: string }[];
  };

  if (!cfJson.success || !cfJson.result) {
    const errMsg = cfJson.errors?.[0]?.message || "Unknown error";
    throw new Error(`Cloudflare Images upload failed: ${errMsg}`);
  }

  const imageId = cfJson.result.id;
  const url = `${CF_DELIVERY_BASE}/${imageId}/public`;

  return { url, imageId };
}

/**
 * Generate an image and upload to Cloudflare Images.
 * Drop-in replacement for the old Replicate-based generateImage().
 *
 * @param prompt - The image generation prompt
 * @param opts.imageInputUrl - Optional source image URL for image-to-image (restyle)
 * @param opts.aspectRatio - "1:1", "4:3", "16:9", etc.
 * @param opts.resolution - "1K", "2K", "4K"
 */
export async function generateImage(
  prompt: string,
  opts?: { imageInputUrl?: string; aspectRatio?: string; resolution?: string },
): Promise<ImageResult> {
  const { geminiKey, cfAccountId, cfImagesToken } = checkEnv();

  // For image-to-image, fetch source as base64
  let imageInputBase64: string | undefined;
  if (opts?.imageInputUrl) {
    const { fetchImageAsBase64 } = await import('./image');
    const { base64 } = await fetchImageAsBase64(opts.imageInputUrl);
    imageInputBase64 = base64;
  }

  // Generate with retry (up to 3 attempts, exponential backoff)
  let lastError: Error | undefined;
  let imageBytes: ArrayBuffer | undefined;
  let mimeType: string | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await runGemini(
        prompt,
        geminiKey,
        imageInputBase64,
        opts?.aspectRatio,
        opts?.resolution,
      );
      imageBytes = result.imageBytes;
      mimeType = result.mimeType;
      break;
    } catch (err: any) {
      lastError = err;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      }
    }
  }

  if (!imageBytes || !mimeType) {
    throw lastError || new Error("Image generation failed after 3 attempts");
  }

  // Upload to Cloudflare
  const { url, imageId } = await uploadToCloudflare(
    imageBytes,
    mimeType,
    cfAccountId,
    cfImagesToken,
  );

  return { url, imageId, generationId: imageId };
}
