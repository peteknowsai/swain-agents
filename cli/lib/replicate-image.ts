/**
 * replicate-image.ts (historical name)
 *
 * Generate images via OpenAI gpt-image-2 and upload to Cloudflare Images.
 * Name is retained while callers migrate; rename to openai-image.ts in a
 * follow-up when the Convex path also migrates.
 *
 * Env vars required:
 *   OPENAI_API_KEY             — OpenAI API key
 *   CLOUDFLARE_ACCOUNT_ID      — Cloudflare account ID
 *   CLOUDFLARE_IMAGES_API_TOKEN — Cloudflare Images API token
 */

import OpenAI from "openai";

const CF_DELIVERY_HASH = process.env.CLOUDFLARE_DELIVERY_HASH || "7NA-8FN5mTUANBxov63ekA";
const CF_DELIVERY_BASE = `https://imagedelivery.net/${CF_DELIVERY_HASH}`;

export interface ReplicateImageResult {
  url: string;        // Cloudflare delivery URL
  imageId: string;    // Cloudflare image ID
  replicateId: string; // OpenAI response id (field name kept for caller compat)
}

type Size = "1024x1024" | "1536x1024" | "1024x1536" | "auto";
type Quality = "low" | "medium" | "high" | "auto";

/**
 * Collapse the rich aspect-ratio strings we accept (1:1, 4:3, 16:9, 21:9,
 * 9:16, match_input_image, …) into the 3 pixel sizes gpt-image-2 supports.
 */
export function aspectToSize(aspect?: string): Size {
  if (!aspect || aspect === "1:1" || aspect === "square") return "1024x1024";
  if (aspect === "match_input_image" || aspect === "auto") return "auto";
  const [w, h] = aspect.split(":").map(Number);
  if (!w || !h) return "1024x1024";
  if (Math.abs(w - h) / Math.max(w, h) < 0.05) return "1024x1024";
  return w > h ? "1536x1024" : "1024x1536";
}

/**
 * Map the legacy --resolution flag to OpenAI quality tiers.
 * 2K/4K is how agents request the merch-upscale spend today; map those to
 * high quality. Everything else gets medium (the day-to-day default).
 */
export function resolutionToQuality(resolution?: string): Quality {
  return resolution === "2K" || resolution === "4K" ? "high" : "medium";
}

function checkEnv(): {
  openaiKey: string;
  cfAccountId: string;
  cfImagesToken: string;
} {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to the 1Password environment or your shell."
    );
  }

  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!cfAccountId) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID is not set. This is required for uploading images to Cloudflare."
    );
  }

  const cfImagesToken = process.env.CLOUDFLARE_IMAGES_API_TOKEN;
  if (!cfImagesToken) {
    throw new Error(
      "CLOUDFLARE_IMAGES_API_TOKEN is not set. This token is required to upload images to Cloudflare."
    );
  }

  return { openaiKey, cfAccountId, cfImagesToken };
}

async function runOpenAI(
  prompt: string,
  openaiKey: string,
  imageInputUrl?: string,
  aspectRatio?: string,
  resolution?: string,
): Promise<{ pngBuffer: Buffer; responseId: string }> {
  const openai = new OpenAI({ apiKey: openaiKey });
  const size = aspectToSize(aspectRatio);
  const quality = resolutionToQuality(resolution);

  console.log(
    `[openai-image] q=${quality} size=${size} img2img=${!!imageInputUrl} prompt=${prompt.length}ch`
  );

  if (imageInputUrl) {
    const r = await fetch(imageInputUrl);
    if (!r.ok) {
      throw new Error(`Failed to fetch input image [${r.status}]`);
    }
    const ab = await r.arrayBuffer();
    const type = r.headers.get("content-type") || "image/png";
    const ext = type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : "png";
    const file = new File([ab], `input.${ext}`, { type });
    const res = await openai.images.edit({
      model: "gpt-image-2",
      prompt,
      image: file,
      size,
      quality,
      n: 1,
    });
    const first = res.data?.[0];
    if (!first?.b64_json) {
      throw new Error("OpenAI images.edit returned no image data");
    }
    return {
      pngBuffer: Buffer.from(first.b64_json, "base64"),
      responseId: String(res.created ?? Date.now()),
    };
  }

  const res = await openai.images.generate({
    model: "gpt-image-2",
    prompt,
    size,
    quality,
    n: 1,
  });
  const first = res.data?.[0];
  if (!first?.b64_json) {
    throw new Error("OpenAI images.generate returned no image data");
  }
  return {
    pngBuffer: Buffer.from(first.b64_json, "base64"),
    responseId: String(res.created ?? Date.now()),
  };
}

async function uploadBufferToCloudflare(
  imageBuffer: Buffer,
  cfAccountId: string,
  cfImagesToken: string
): Promise<{ url: string; imageId: string }> {
  const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/images/v1`;
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([new Uint8Array(imageBuffer)], { type: "image/png" }),
    "image.png"
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
 * Generate an image from a prompt using OpenAI gpt-image-2 and upload to
 * Cloudflare Images.
 *
 * @param prompt - The image generation prompt
 * @param opts.imageInputUrl - Optional source image URL for image-to-image (restyle)
 * @param opts.aspectRatio   - Aspect ratio hint; mapped to the 3 sizes gpt-image-2 supports
 * @param opts.resolution    - Legacy tier flag. "2K"/"4K" ⇒ high quality, else medium
 * @returns Cloudflare delivery URL, image ID, and OpenAI response id
 */
export async function generateImage(
  prompt: string,
  opts?: { imageInputUrl?: string; aspectRatio?: string; resolution?: string }
): Promise<ReplicateImageResult> {
  const { openaiKey, cfAccountId, cfImagesToken } = checkEnv();

  let lastError: Error | undefined;
  let pngBuffer: Buffer | undefined;
  let responseId: string | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await runOpenAI(
        prompt,
        openaiKey,
        opts?.imageInputUrl,
        opts?.aspectRatio,
        opts?.resolution
      );
      pngBuffer = result.pngBuffer;
      responseId = result.responseId;
      break;
    } catch (err: any) {
      lastError = err;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  if (!pngBuffer || !responseId) {
    throw lastError || new Error("Image generation failed after 2 attempts");
  }

  const { url, imageId } = await uploadBufferToCloudflare(
    pngBuffer,
    cfAccountId,
    cfImagesToken
  );

  return { url, imageId, replicateId: responseId };
}
