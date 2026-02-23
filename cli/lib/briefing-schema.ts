/**
 * Briefing item validation — local copy of types from @peteknowsai/briefing-schema.
 *
 * Source of truth is the schema package. When it adds/changes types,
 * update VALID_TYPES and the type-specific checks below.
 *
 * Types and fields (from briefing-schema@1.0.1):
 *   greeting:       { type, content }
 *   text:           { type, content }
 *   closing:        { type, content }
 *   card:           { type, id }
 *   image_card:     { type, id?, title?, subtext?, image?, content_markdown?, backgroundColor?, category? }
 *   survey:         { type, id, question?, prompt?, field?, options }
 *   multi_select:   { type, id, question?, prompt?, field?, options, min_selections?, max_selections? }
 *   multi_select_survey: (alias for multi_select)
 *   text_input:     { type, id, question?, prompt?, field?, placeholder?, optional? }
 *   photo_upload:   { type, id?, prompt?, question?, field? }
 *   image_upload:   { type, id, title, description?, optional? }
 */

const VALID_TYPES = new Set([
  'greeting', 'text', 'closing', 'card', 'image_card',
  'survey', 'multi_select', 'multi_select_survey',
  'text_input', 'photo_upload', 'image_upload',
]);

// Types that require a non-empty `content` string
const CONTENT_TYPES = new Set(['greeting', 'text', 'closing']);

function validateItem(item: unknown, index: number): string | null {
  if (!item || typeof item !== 'object') {
    return `[${index}] item must be an object`;
  }

  const obj = item as Record<string, unknown>;

  if (!obj.type || typeof obj.type !== 'string') {
    return `[${index}] missing or invalid "type"`;
  }

  if (!VALID_TYPES.has(obj.type)) {
    return `[${index}] unknown type "${obj.type}" — valid types: ${[...VALID_TYPES].join(', ')}`;
  }

  // Content-bearing types: greeting, text, closing
  if (CONTENT_TYPES.has(obj.type)) {
    // Common mistake: using "text" or "message" instead of "content"
    if ('text' in obj && !('content' in obj)) {
      return `[${index}] ${obj.type} items use "content", not "text"`;
    }
    if ('message' in obj && !('content' in obj)) {
      return `[${index}] ${obj.type} items use "content", not "message"`;
    }
    if (typeof obj.content !== 'string' || obj.content.length === 0) {
      return `[${index}] ${obj.type} items require a non-empty "content" string`;
    }
  }

  // Card references
  if (obj.type === 'card') {
    if ('cardId' in obj) {
      return `[${index}] card items use "id", not "cardId"`;
    }
    if (typeof obj.id !== 'string' || !obj.id.startsWith('card_')) {
      return `[${index}] card items require "id" starting with "card_"`;
    }
  }

  return null;
}

export function validateItems(items: unknown[]): {
  success: true;
} | {
  success: false;
  errors: string[];
} {
  if (!Array.isArray(items)) {
    return { success: false, errors: ['items must be an array'] };
  }

  const errors: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const err = validateItem(items[i], i);
    if (err) errors.push(err);
  }

  if (errors.length > 0) return { success: false, errors };
  return { success: true };
}
