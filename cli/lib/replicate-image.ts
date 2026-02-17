/**
 * replicate-image.ts
 *
 * Generate images via Replicate API (lucataco/nano-banana-txt2img)
 * and upload to Cloudflare Images.
 *
 * Env vars required:
 *   REPLICATE_API_TOKEN        — Replicate API token
 *   CLOUDFLARE_ACCOUNT_ID      — Cloudflare account ID
 *   CLOUDFLARE_IMAGES_API_TOKEN — Cloudflare Images API token
 */

const REPLICATE_MODEL_URL =
  "https://api.replicate.com/v1/models/google/nano-banana-pro/predictions";

const CF_DELIVERY_BASE =
  "https://imagedelivery.net/7NA-8FN5mTUANBxov63ekA";

export interface ReplicateImageResult {
  url: string;        // Cloudflare delivery URL
  imageId: string;    // Cloudflare image ID
  replicateId: string; // Replicate prediction ID
}

/**
 * Check that all required env vars are set. Throws with a clear message if not.
 */
function checkEnv(): {
  replicateToken: string;
  cfAccountId: string;
  cfImagesToken: string;
} {
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (!replicateToken) {
    throw new Error(
      "REPLICATE_API_TOKEN is not set. Ask Pete for the token and add it to your environment."
    );
  }

  const cfAccountId =
    process.env.CLOUDFLARE_ACCOUNT_ID || "5a6fef07a998d84ec047ef43d0543342";

  const cfImagesToken = process.env.CLOUDFLARE_IMAGES_API_TOKEN;
  if (!cfImagesToken) {
    throw new Error(
      "CLOUDFLARE_IMAGES_API_TOKEN is not set. This token is required to upload images to Cloudflare."
    );
  }

  return { replicateToken, cfAccountId, cfImagesToken };
}

/**
 * Create a prediction on Replicate and poll until complete.
 * Returns the output image URL from Replicate (temporary).
 */
async function runReplicate(
  prompt: string,
  replicateToken: string
): Promise<{ outputUrl: string; predictionId: string }> {
  // Create prediction
  const createRes = await fetch(REPLICATE_MODEL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${replicateToken}`,
      "Content-Type": "application/json",
      Prefer: "wait",  // Use Replicate's sync mode — waits up to 60s
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: "4:3",
        output_format: "jpg",
      },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(
      `Replicate create prediction failed [${createRes.status}]: ${errText}`
    );
  }

  let prediction = (await createRes.json()) as any;

  // If the "Prefer: wait" header worked, we may already have output
  if (prediction.status === "succeeded" && prediction.output) {
    const outputUrl = Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output;
    return { outputUrl, predictionId: prediction.id };
  }

  if (prediction.status === "failed" || prediction.status === "canceled") {
    throw new Error(
      `Replicate prediction ${prediction.status}: ${prediction.error || "unknown error"}`
    );
  }

  // Poll for completion
  const pollUrl =
    prediction.urls?.get ||
    `https://api.replicate.com/v1/predictions/${prediction.id}`;
  const maxPollTime = 120_000; // 2 minutes
  const pollInterval = 2_000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxPollTime) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${replicateToken}` },
    });

    if (!pollRes.ok) {
      const errText = await pollRes.text();
      throw new Error(
        `Replicate poll failed [${pollRes.status}]: ${errText}`
      );
    }

    prediction = await pollRes.json();

    if (prediction.status === "succeeded" && prediction.output) {
      const outputUrl = Array.isArray(prediction.output)
        ? prediction.output[0]
        : prediction.output;
      return { outputUrl, predictionId: prediction.id };
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(
        `Replicate prediction ${prediction.status}: ${prediction.error || "unknown error"}`
      );
    }

    // Still processing — continue polling
  }

  throw new Error("Replicate prediction timed out after 120s");
}

/**
 * Download an image from a URL and upload it to Cloudflare Images.
 * Returns the Cloudflare delivery URL and image ID.
 */
async function uploadToCloudflare(
  imageUrl: string,
  cfAccountId: string,
  cfImagesToken: string
): Promise<{ url: string; imageId: string }> {
  // Download image bytes
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(
      `Failed to download image from Replicate [${imgRes.status}]`
    );
  }
  const imageData = await imgRes.arrayBuffer();

  // Upload to Cloudflare Images
  const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/images/v1`;
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([imageData], { type: "image/jpeg" }),
    "image.jpg"
  );

  const cfRes = await fetch(cfUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfImagesToken}`,
    },
    body: formData,
  });

  if (!cfRes.ok) {
    const errText = await cfRes.text();
    throw new Error(
      `Cloudflare Images upload failed [${cfRes.status}]: ${errText}`
    );
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
 * Generate an image from a prompt using Replicate and upload to Cloudflare Images.
 *
 * @param prompt - The image generation prompt
 * @returns Cloudflare delivery URL, image ID, and Replicate prediction ID
 */
export async function generateImage(
  prompt: string
): Promise<ReplicateImageResult> {
  const { replicateToken, cfAccountId, cfImagesToken } = checkEnv();

  // Step 1: Generate via Replicate
  const { outputUrl, predictionId } = await runReplicate(prompt, replicateToken);

  // Step 2: Download and upload to Cloudflare Images
  const { url, imageId } = await uploadToCloudflare(
    outputUrl,
    cfAccountId,
    cfImagesToken
  );

  return { url, imageId, replicateId: predictionId };
}
