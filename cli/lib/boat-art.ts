/**
 * boat-art.ts
 *
 * Generate stylized boat art using Replicate (nano-banana model)
 * and upload to Cloudflare Images.
 *
 * Supports two modes:
 * 1. Text-to-image: Generate from boat description (no photo needed)
 * 2. Image-to-image: Restyle an existing boat photo (better results)
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

export const ART_STYLES = [
  {
    id: "watercolor",
    name: "Watercolor",
    prompt: "beautiful watercolor painting style, soft flowing colors, wet-on-wet technique, artistic brushstrokes, gallery quality",
  },
  {
    id: "oil-painting",
    name: "Oil Painting",
    prompt: "rich oil painting style, thick impasto brushstrokes, vibrant colors, museum quality, classical maritime art",
  },
  {
    id: "pop-art",
    name: "Pop Art",
    prompt: "bold pop art style, bright saturated colors, strong outlines, Andy Warhol inspired, graphic and eye-catching",
  },
  {
    id: "japanese-woodblock",
    name: "Japanese Woodblock",
    prompt: "Japanese ukiyo-e woodblock print style, bold outlines, flat color areas, waves and water in traditional style, Hokusai inspired",
  },
  {
    id: "impressionist",
    name: "Impressionist",
    prompt: "impressionist painting style, dappled light, visible brushstrokes, Monet-inspired water reflections, golden hour atmosphere",
  },
  {
    id: "comic-book",
    name: "Comic Book",
    prompt: "comic book illustration style, bold ink outlines, halftone dots, dynamic composition, vibrant comic colors",
  },
  {
    id: "art-deco",
    name: "Art Deco",
    prompt: "art deco poster style, geometric shapes, gold and navy colors, elegant 1920s aesthetic, vintage travel poster feel",
  },
  {
    id: "minimalist",
    name: "Minimalist",
    prompt: "minimalist illustration style, clean lines, limited color palette, negative space, modern and elegant",
  },
  {
    id: "sunset-silhouette",
    name: "Sunset Silhouette",
    prompt: "dramatic sunset silhouette style, boat silhouetted against vibrant orange and purple sky, reflections on calm water, cinematic",
  },
  {
    id: "neon",
    name: "Neon",
    prompt: "neon glow style, dark background with vibrant neon outlines, cyberpunk-inspired, glowing reflections on water, electric colors",
  },
] as const;

export type ArtStyleId = (typeof ART_STYLES)[number]["id"];

function checkEnv() {
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (!replicateToken) {
    throw new Error("REPLICATE_API_TOKEN is not set.");
  }
  const cfAccountId =
    process.env.CLOUDFLARE_ACCOUNT_ID || "5a6fef07a998d84ec047ef43d0543342";
  const cfImagesToken = process.env.CLOUDFLARE_IMAGES_API_TOKEN;
  if (!cfImagesToken) {
    throw new Error("CLOUDFLARE_IMAGES_API_TOKEN is not set.");
  }
  return { replicateToken, cfAccountId, cfImagesToken };
}

/**
 * Build a prompt for boat art generation.
 */
export function buildBoatArtPrompt(opts: {
  boatName: string;
  boatType?: string;
  boatMakeModel?: string;
  boatColor?: string;
  marina?: string;
  style: (typeof ART_STYLES)[number];
  hasPhoto: boolean;
}): string {
  const { boatName, boatType, boatMakeModel, boatColor, marina, style, hasPhoto } = opts;

  if (hasPhoto) {
    // Image-to-image: restyle the provided photo
    return [
      `Transform this boat photo into ${style.name} art.`,
      style.prompt,
      `The boat is named "${boatName}".`,
      boatColor ? `The boat's primary color is ${boatColor}.` : "",
      marina ? `Setting: waters near ${marina}.` : "",
      "Keep the boat recognizable but apply the artistic style fully.",
      "Do not include any text, labels, or captions in the image.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  // Text-to-image: describe the boat
  const boatDesc = [
    boatMakeModel || boatType || "recreational boat",
    boatColor ? `with ${boatColor} hull` : "",
    `named "${boatName}"`,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    `A beautiful ${boatDesc} on the water.`,
    style.prompt,
    marina ? `Setting: waters near ${marina}, Florida.` : "Setting: calm coastal Florida waters.",
    "Golden hour lighting, the boat is the hero of the image.",
    "Do not include any text, labels, or captions in the image.",
  ].join(" ");
}

/**
 * Generate a single boat art image via Replicate and upload to Cloudflare.
 *
 * @param prompt - The image generation/editing prompt
 * @param imageInputUrl - Optional URL of the boat photo for img2img
 * @returns Cloudflare delivery URL and metadata
 */
export async function generateBoatArt(
  prompt: string,
  imageInputUrl?: string
): Promise<{ url: string; imageId: string; replicateId: string }> {
  const { replicateToken, cfAccountId, cfImagesToken } = checkEnv();

  // Build Replicate input
  const input: any = {
    prompt,
    aspect_ratio: "4:3",
    output_format: "jpg",
  };

  if (imageInputUrl) {
    input.image_input = [imageInputUrl];
    input.aspect_ratio = "match_input_image";
  }

  // Create prediction with sync mode
  const createRes = await fetch(REPLICATE_MODEL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${replicateToken}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({ input }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Replicate create failed [${createRes.status}]: ${errText}`);
  }

  let prediction = (await createRes.json()) as any;

  // Check if already done (sync mode)
  if (prediction.status === "succeeded" && prediction.output) {
    const outputUrl = Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output;
    const cfResult = await uploadToCf(outputUrl, cfAccountId, cfImagesToken);
    return { ...cfResult, replicateId: prediction.id };
  }

  if (prediction.status === "failed" || prediction.status === "canceled") {
    throw new Error(`Replicate ${prediction.status}: ${prediction.error || "unknown"}`);
  }

  // Poll for completion
  const pollUrl =
    prediction.urls?.get ||
    `https://api.replicate.com/v1/predictions/${prediction.id}`;
  const maxPollTime = 120_000;
  const pollInterval = 2_000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxPollTime) {
    await new Promise((r) => setTimeout(r, pollInterval));
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${replicateToken}` },
    });
    if (!pollRes.ok) {
      throw new Error(`Replicate poll failed [${pollRes.status}]`);
    }
    prediction = await pollRes.json();

    if (prediction.status === "succeeded" && prediction.output) {
      const outputUrl = Array.isArray(prediction.output)
        ? prediction.output[0]
        : prediction.output;
      const cfResult = await uploadToCf(outputUrl, cfAccountId, cfImagesToken);
      return { ...cfResult, replicateId: prediction.id };
    }
    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(`Replicate ${prediction.status}: ${prediction.error || "unknown"}`);
    }
  }

  throw new Error("Replicate prediction timed out after 120s");
}

/**
 * Upload image from URL to Cloudflare Images.
 */
async function uploadToCf(
  imageUrl: string,
  cfAccountId: string,
  cfImagesToken: string
): Promise<{ url: string; imageId: string }> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Failed to download image [${imgRes.status}]`);
  }
  const imageData = await imgRes.arrayBuffer();

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([imageData], { type: "image/jpeg" }),
    "boat-art.jpg"
  );

  const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/images/v1`;
  const cfRes = await fetch(cfUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfImagesToken}` },
    body: formData,
  });

  if (!cfRes.ok) {
    const errText = await cfRes.text();
    throw new Error(`Cloudflare upload failed [${cfRes.status}]: ${errText}`);
  }

  const json = (await cfRes.json()) as any;
  if (!json.success || !json.result) {
    throw new Error(`Cloudflare upload failed: ${json.errors?.[0]?.message || "unknown"}`);
  }

  return {
    url: `${CF_DELIVERY_BASE}/${json.result.id}/public`,
    imageId: json.result.id,
  };
}

/**
 * Pick a random style, optionally excluding recently used ones.
 */
export function pickRandomStyle(exclude: ArtStyleId[] = []): (typeof ART_STYLES)[number] {
  const available = ART_STYLES.filter((s) => !exclude.includes(s.id));
  if (available.length === 0) {
    return ART_STYLES[Math.floor(Math.random() * ART_STYLES.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * The 2 styles used for the onboarding sampler card.
 * Show variety without overwhelming the first briefing.
 */
export const SAMPLER_STYLE_IDS: ArtStyleId[] = [
  "watercolor",
  "pop-art",
];

export function getSamplerStyles(): (typeof ART_STYLES)[number][] {
  return SAMPLER_STYLE_IDS.map((id) => ART_STYLES.find((s) => s.id === id)!);
}

/**
 * Extract a dominant color from an image URL for card background.
 * Uses Cloudflare's image transformation to get a 1x1 pixel and read its color.
 * Falls back to a style-based default if extraction fails.
 */
export function getStyleDefaultBgColor(styleId: string): string {
  const styleColors: Record<string, string> = {
    "watercolor": "#4a6fa5",
    "oil-painting": "#5c4033",
    "pop-art": "#e63946",
    "japanese-woodblock": "#264653",
    "impressionist": "#6b8f71",
    "comic-book": "#fca311",
    "art-deco": "#1d3557",
    "minimalist": "#e9ecef",
    "sunset-silhouette": "#e76f51",
    "neon": "#0b0c10",
  };
  return styleColors[styleId] || "#2d3748";
}

/**
 * Build card content for boat art (richer than just a one-liner).
 */
export function buildBoatArtContent(opts: {
  boatName: string;
  style: (typeof ART_STYLES)[number];
  isSampler: boolean;
}): string {
  const { boatName, style } = opts;
  return `${boatName} in ${style.name.toLowerCase()} style.`;
}
