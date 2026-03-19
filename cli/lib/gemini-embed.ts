/**
 * Gemini Embed 2 — text embedding via Google's API
 *
 * Model: text-embedding-004 (768 dimensions)
 * Used for agent knowledge queries (RETRIEVAL_QUERY) and storage (RETRIEVAL_DOCUMENT)
 */

const GEMINI_EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';
const DIMENSIONS = 768;

export type TaskType = 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY';

/**
 * Embed text using Gemini text-embedding-004.
 * Returns a 768-dimension float array.
 */
export async function embedText(text: string, taskType: TaskType = 'RETRIEVAL_DOCUMENT'): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required for knowledge operations');
  }

  const response = await fetch(`${GEMINI_EMBED_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini embedding failed [${response.status}]: ${err}`);
  }

  const data = await response.json() as { embedding: { values: number[] } };
  return data.embedding.values;
}

export { DIMENSIONS };
