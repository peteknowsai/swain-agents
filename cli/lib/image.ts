/**
 * image.ts
 *
 * Unified image generation library.
 * Sits between replicate-image.ts (infra) and CLI commands (UI).
 *
 * - Prompt suffix constants for consistent "no text" instructions
 * - generate() — the single entry point for all image generation
 * - Boat art styles, prompts, and content helpers
 */

import { generateImage, type ReplicateImageResult } from './replicate-image';

// ── Prompt suffixes ────────────────────────────────────────────────

export const PROMPT_NO_TEXT = 'Do not include any text, labels, or captions in the image.';
export const PROMPT_FULL_BLEED = 'Full-bleed, no text or labels.';
export const PROMPT_CARD_CONTEXT = 'This image accompanies a story card - the headline is added separately. Do not include title text, labels, or captions in the image. Text naturally part of the scene (boat name, marina sign) is fine.';

// ── Unified generate ───────────────────────────────────────────────

export async function generate(prompt: string, opts?: {
  imageInputUrl?: string;
  suffix?: string;  // defaults to PROMPT_FULL_BLEED
  fast?: boolean;   // use nano-banana (fast) instead of nano-banana-pro (quality)
}): Promise<ReplicateImageResult> {
  const fullPrompt = `${prompt.trim()}. ${opts?.suffix ?? PROMPT_FULL_BLEED}`;
  return generateImage(fullPrompt, { imageInputUrl: opts?.imageInputUrl, fast: opts?.fast });
}

// ── Boat art styles ────────────────────────────────────────────────
// 30 print-ready styles optimized for physical merch:
// art prints, stickers, coffee mugs, koozies.
// Each style includes bgColor for card backgrounds.

export const ART_STYLES = [
  // ── Clean / Illustration ──
  {
    id: "clean-line",
    name: "Clean Line Illustration",
    bgColor: "#ffffff",
    prompt: "clean line illustration, precise ink outlines, flat color fills, white background, technical yet artistic, marine illustration style, sharp vector-like edges, minimal shading",
  },
  {
    id: "colored-pencil",
    name: "Colored Pencil",
    bgColor: "#f5e6d3",
    prompt: "colored pencil drawing on white paper, visible pencil strokes and paper texture, warm natural colors, detailed hatching and layering, illustration quality, soft blended tones",
  },
  {
    id: "blueprint",
    name: "Blueprint",
    bgColor: "#0a2463",
    prompt: "technical blueprint style, white lines on deep blue background, precise mechanical drawing, engineering schematic aesthetic, fine detail lines, drafting style with clean geometry",
  },
  // ── Painterly ──
  {
    id: "watercolor",
    name: "Watercolor",
    bgColor: "#4a6fa5",
    prompt: "watercolor painting on white paper, transparent washes, wet-on-wet color bleeds, visible paper texture, soft edges with selective sharp details, clean white background showing through",
  },
  {
    id: "japanese-woodblock",
    name: "Japanese Woodblock",
    bgColor: "#264653",
    prompt: "Japanese ukiyo-e woodblock print, bold black outlines, flat color blocks, stylized water patterns, traditional wave and foam treatment, limited color palette, Hokusai-inspired composition",
  },
  // ── Bold / Graphic ──
  {
    id: "pop-art",
    name: "Pop Art",
    bgColor: "#e63946",
    prompt: "pop art style, bold flat colors, thick black outlines, Ben-Day dots pattern, high contrast, Lichtenstein-inspired, graphic and punchy, limited bright color palette",
  },
  {
    id: "comic-book",
    name: "Comic Book",
    bgColor: "#fca311",
    prompt: "comic book illustration, bold black ink outlines, halftone dot shading, dynamic action perspective, bright saturated comic colors, cel-shaded, speech-bubble-era aesthetic",
  },
  {
    id: "retro-poster",
    name: "Retro Travel Poster",
    bgColor: "#c2703e",
    prompt: "vintage travel poster illustration, flat bold shapes, limited color palette of 4-5 colors, screen print aesthetic, 1950s tourism poster style, geometric simplification, strong graphic composition",
  },
  {
    id: "neon-glow",
    name: "Neon Glow",
    bgColor: "#0b0c10",
    prompt: "neon glow illustration, glowing neon outlines on dark background, electric blue and hot pink and cyan, light bloom effects, dark navy or black background, synthwave aesthetic, clean neon tube lines",
  },
  {
    id: "stencil",
    name: "Stencil",
    bgColor: "#1a1a2e",
    prompt: "stencil art style, high contrast two-tone, spray paint texture, Banksy-inspired urban art aesthetic, bold graphic silhouette with selective detail, raw and edgy, street art quality",
  },
  // ── Screen Print / Production ──
  {
    id: "screen-print",
    name: "Screen Print",
    bgColor: "#f2e8d5",
    prompt: "vintage screen print, 2-3 color separation, slight misregistration, heavy ink on cotton texture, retro americana feel, bold simplified shapes, distressed worn edges",
  },
  {
    id: "risograph",
    name: "Risograph",
    bgColor: "#fef9ef",
    prompt: "risograph print style, bold overlapping color layers, slight misregistration, grainy ink texture, limited to 3 spot colors, modern indie poster aesthetic, visible halftone grain",
  },
  // ── Nautical / Maritime ──
  {
    id: "nautical-tattoo",
    name: "Nautical Tattoo",
    bgColor: "#fdf6e3",
    prompt: "traditional sailor tattoo style, bold black outlines, limited flat color fills, old school americana tattoo aesthetic, clean bold lines on skin-tone background, classic maritime iconography",
  },
  {
    id: "nautical-engraving",
    name: "Nautical Engraving",
    bgColor: "#f5f0e8",
    prompt: "detailed nautical engraving, fine crosshatch shading, copper plate etching style, Victorian-era maritime illustration, precise fine lines, museum quality technical drawing",
  },
  {
    id: "vintage-chart",
    name: "Vintage Chart",
    bgColor: "#e8dcc8",
    prompt: "aged nautical chart illustration, hand-drawn cartography style, sepia and faded ink tones, compass rose decorative elements, old parchment paper texture, antique maritime map aesthetic",
  },
  // ── Coastal / Lifestyle ──
  {
    id: "tiki",
    name: "Tiki",
    bgColor: "#2d1810",
    prompt: "tiki bar poster art, tropical retro polynesian style, carved wood texture, warm oranges and teals, mid-century tropical illustration, exotic and bold, vintage hawaiian shirt aesthetic",
  },
  {
    id: "vintage-florida",
    name: "Vintage Florida",
    bgColor: "#f4a460",
    prompt: "vintage 1960s Florida postcard illustration, sun-bleached pastel colors, retro tourism art, faded warm tones, hand-lettered feel, nostalgic coastal Americana, old motel sign aesthetic",
  },
  {
    id: "surf-art",
    name: "Surf Art",
    bgColor: "#f7f3e9",
    prompt: "1970s surf culture illustration, clean single-weight line art, flat earthy color palette, Rick Griffin inspired, retro beach poster style, laid-back coastal aesthetic, vintage board short print",
  },
  // ── Craft / Handmade ──
  {
    id: "embroidery",
    name: "Embroidery",
    bgColor: "#2c3e50",
    prompt: "embroidered patch illustration, visible thread texture and stitching, satin stitch fills, chain stitch outlines, fabric background texture, scout badge aesthetic, hand-crafted quality",
  },
  {
    id: "paper-cutout",
    name: "Paper Cutout",
    bgColor: "#ffffff",
    prompt: "layered paper cut art, visible paper layers with subtle shadows between, clean cut edges, limited color palette, dimensional depth from overlapping shapes, modern craft aesthetic",
  },
  // ── Modern / Digital ──
  {
    id: "flat-vector",
    name: "Flat Vector",
    bgColor: "#ffffff",
    prompt: "clean flat vector illustration, modern minimal design, no gradients or shadows, bold geometric shapes, contemporary app icon aesthetic, crisp edges, Silicon Valley illustration style",
  },
  {
    id: "cartoon",
    name: "Cartoon",
    bgColor: "#87ceeb",
    prompt: "bright cartoon illustration, exaggerated fun proportions, thick cheerful outlines, saturated happy colors, animated movie quality, playful and approachable, Pixar-inspired rendering",
  },
  {
    id: "pixel-art",
    name: "Pixel Art",
    bgColor: "#2b2d42",
    prompt: "pixel art style, visible square pixels, 16-bit retro game aesthetic, limited color palette, clean pixel edges, nostalgic video game illustration, crisp and detailed within pixel grid",
  },
  // ── Monochrome ──
  {
    id: "mono-navy",
    name: "Navy Mono",
    bgColor: "#ffffff",
    prompt: "single navy blue color illustration on white, clean precise lines, nautical blue ink drawing, detailed but single color, classic maritime illustration, timeless and elegant",
  },
  {
    id: "chalk",
    name: "Chalkboard",
    bgColor: "#2d3436",
    prompt: "white chalk drawing on dark chalkboard, hand-drawn chalk texture, slight chalk dust and smudge, restaurant menu board aesthetic, casual yet detailed, warm and inviting",
  },
  {
    id: "sepia-sketch",
    name: "Sepia Sketch",
    bgColor: "#f5f0e8",
    prompt: "detailed sepia pencil sketch, warm brown tones on cream paper, fine detailed shading, architectural rendering quality, vintage photograph feel, nostalgic and refined, old master drawing style",
  },
  // ── Premium / Specialty ──
  {
    id: "art-deco",
    name: "Art Deco",
    bgColor: "#1d3557",
    prompt: "art deco illustration, geometric patterns, gold and navy color scheme, elegant symmetry, 1920s luxury aesthetic, Gatsby-era glamour, ornamental line work, chrome and gold metallic feel",
  },
  {
    id: "linocut",
    name: "Linocut",
    bgColor: "#1b1b1b",
    prompt: "linocut print style, bold carved lines, high contrast black and white with one accent color, woodcut texture, hand-printed aesthetic, visible carving marks, strong graphic shapes",
  },
  {
    id: "gold-foil",
    name: "Gold Foil",
    bgColor: "#0d1b2a",
    prompt: "gold foil illustration on dark navy background, metallic gold line art, elegant engraving style, fine detailed lines, luxury nautical chart aesthetic, rich gold tones on deep blue-black",
  },
  {
    id: "psychedelic",
    name: "Psychedelic",
    bgColor: "#1a0533",
    prompt: "1960s psychedelic poster art, flowing organic shapes, vibrant swirling colors, acid-inspired color combinations, Art Nouveau influenced curves, concert poster aesthetic, bold and trippy",
  },
] as const;

export type ArtStyleId = (typeof ART_STYLES)[number]["id"];

/**
 * Build a prompt for boat art generation.
 */
export function buildBoatArtPrompt(opts: {
  boatName: string;
  boatType?: string;
  boatMakeModel?: string;
  boatColor?: string;
  style: (typeof ART_STYLES)[number];
  hasPhoto: boolean;
}): string {
  const { boatName, boatType, boatMakeModel, boatColor, style, hasPhoto } = opts;

  if (hasPhoto) {
    // Image-to-image: restyle the provided photo
    // Key: isolate the boat on a clean background with minimal water —
    // just a thin wake/splash at the waterline. The boat is the hero.
    return [
      `Transform this photo into ${style.name} art.`,
      style.prompt,
      "Preserve all people, objects, and details from the original photo.",
      "Keep the subject recognizable but apply the artistic style fully.",
      "Isolate the boat on a clean white background. Minimize the water — only a thin strip of stylized water or wake directly at the waterline. The boat should dominate the composition, not the ocean.",
      "Print-ready composition suitable for posters, mugs, and stickers.",
      PROMPT_NO_TEXT,
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
    `A ${boatDesc}.`,
    style.prompt,
    "Side profile view, isolated on clean white background. Only a thin strip of stylized water or wake at the waterline. The boat dominates the composition.",
    "Print-ready illustration suitable for posters, mugs, and stickers.",
    PROMPT_NO_TEXT,
  ].join(" ");
}

/**
 * Pick the single best style for a boat's first impression.
 * Matches on boatType and boatMakeModel keywords to find the style
 * that'll look most impressive as the captain's first piece of art.
 */
export function pickBestStyle(boatType?: string, boatMakeModel?: string): (typeof ART_STYLES)[number] {
  const text = `${boatType || ""} ${boatMakeModel || ""}`.toLowerCase();

  // Sportfisher / convertible — clean technical illustration is the money shot
  if (/sportfish|convertible|viking|bertram|hatteras|cabo|jarrett|spencer|merritt|jim smith|sculley|release|riviera/.test(text)) {
    return ART_STYLES.find(s => s.id === "clean-line")!;
  }
  // Sailboat — watercolor captures those lines perfectly
  if (/sail|sloop|ketch|yawl|cutter|catalina|beneteau|hunter|jeanneau|island packet|hinckley|swan|oyster|hallberg|dufour|tartan/.test(text)) {
    return ART_STYLES.find(s => s.id === "watercolor")!;
  }
  // Motor yacht / cruiser — art deco luxury
  if (/yacht|cruiser|azimut|sunseeker|princess|ferretti|prestige|tiara|pursuit|sea ray.*[4-9]\d/.test(text)) {
    return ART_STYLES.find(s => s.id === "art-deco")!;
  }
  // Classic / vintage — fine engraving for heritage boats
  if (/classic|vintage|chris.?craft|riva|garwood|hacker|antique|wooden/.test(text)) {
    return ART_STYLES.find(s => s.id === "nautical-engraving")!;
  }
  // Bay / flats / skiff — Florida coastal culture
  if (/bay\s?boat|flats|skiff|pathfinder|maverick|hewes|east cape|chittum|beavertail|hells? bay|action craft/.test(text)) {
    return ART_STYLES.find(s => s.id === "vintage-florida")!;
  }
  // Center console — screen print, fishing-forward
  if (/center console|boston whaler|yellowfin|contender|seavee|invincible|cobia|robalo|sportsman|key west|everglades|regulator|freeman|grady|fountain|scout/.test(text)) {
    return ART_STYLES.find(s => s.id === "screen-print")!;
  }
  // Pontoon / deck — fun and playful
  if (/pontoon|deck boat|bennington|harris|sun tracker|sylvan|crest|manitou|godfrey|avalon/.test(text)) {
    return ART_STYLES.find(s => s.id === "cartoon")!;
  }
  // Ski / wake — vibrant and active
  if (/ski|wake|malibu|mastercraft|nautique|centurion|supra|tige|moomba|axis/.test(text)) {
    return ART_STYLES.find(s => s.id === "pop-art")!;
  }
  // Bass / freshwater — bold and sporty
  if (/bass|ranger|skeeter|nitro|triton|phoenix|vexus|tracker/.test(text)) {
    return ART_STYLES.find(s => s.id === "stencil")!;
  }
  // Trawler — classic voyaging aesthetic
  if (/trawler|kadey|nordhavn|fleming|grand banks|american tug|ranger tug|helmsman|nordic tug/.test(text)) {
    return ART_STYLES.find(s => s.id === "nautical-engraving")!;
  }
  // Catamaran — bold outlines handle the wide beam
  if (/catamaran|cat|lagoon|fountaine|leopard|gemini|seawind|bali/.test(text)) {
    return ART_STYLES.find(s => s.id === "japanese-woodblock")!;
  }

  // Default — clean-line is always impressive
  return ART_STYLES.find(s => s.id === "clean-line")!;
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
  "clean-line",
  "pop-art",
];

export function getSamplerStyles(): (typeof ART_STYLES)[number][] {
  return SAMPLER_STYLE_IDS.map((id) => ART_STYLES.find((s) => s.id === id)!);
}

export function getStyleDefaultBgColor(styleId: string): string {
  const style = ART_STYLES.find(s => s.id === styleId);
  return style?.bgColor || "#2d3748";
}

/**
 * Build card content for boat art.
 */
export function buildBoatArtContent(opts: {
  boatName: string;
  style: (typeof ART_STYLES)[number];
  isSampler: boolean;
}): string {
  const { boatName, style } = opts;
  return `${boatName} in ${style.name.toLowerCase()} style.`;
}
