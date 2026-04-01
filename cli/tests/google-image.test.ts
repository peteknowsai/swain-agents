import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

// Helper: build a mock Gemini response with base64 image data
function geminiImageResponse(base64Data = 'AQID') {
  return {
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{
            inlineData: {
              mimeType: 'image/png',
              data: base64Data,
            },
          }],
        },
      }],
    }),
  };
}

function cfUploadResponse(imageId = 'cf-img-123') {
  return {
    ok: true,
    json: async () => ({
      success: true,
      result: { id: imageId, variants: [`https://imagedelivery.net/abc/${imageId}/public`] },
    }),
  };
}

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.CLOUDFLARE_ACCOUNT_ID = 'test-cf-account';
  process.env.CLOUDFLARE_IMAGES_API_TOKEN = 'test-cf-images-token';
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GEMINI_API_KEY;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_IMAGES_API_TOKEN;
});

describe('generateImage', () => {
  test('generates image and uploads to Cloudflare', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(geminiImageResponse())
      .mockResolvedValueOnce(cfUploadResponse('cf-img-123'));

    vi.stubGlobal('fetch', mockFetch);
    const { generateImage } = await import('../lib/google-image');

    const result = await generateImage('test prompt');

    expect(result.imageId).toBe('cf-img-123');
    expect(result.url).toContain('cf-img-123');

    // Verify Gemini request format
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain(GEMINI_URL);
    expect(url).toContain('key=test-gemini-key');
    const body = JSON.parse(opts.body);
    expect(body.contents[0].parts[0].text).toBe('test prompt');
    expect(body.generationConfig.responseModalities).toEqual(['IMAGE']);
  });

  test('passes aspect ratio to imageConfig', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(geminiImageResponse())
      .mockResolvedValueOnce(cfUploadResponse());

    vi.stubGlobal('fetch', mockFetch);
    const { generateImage } = await import('../lib/google-image');

    await generateImage('test', { aspectRatio: '16:9' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.generationConfig.imageConfig.aspectRatio).toBe('16:9');
  });

  test('passes resolution to imageConfig as imageSize', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(geminiImageResponse())
      .mockResolvedValueOnce(cfUploadResponse());

    vi.stubGlobal('fetch', mockFetch);
    const { generateImage } = await import('../lib/google-image');

    await generateImage('test', { resolution: '4K' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.generationConfig.imageConfig.imageSize).toBe('4K');
  });

  test('Gemini API error throws', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad request',
    })
    // Retry
    .mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad request',
    });

    vi.stubGlobal('fetch', mockFetch);
    const { generateImage } = await import('../lib/google-image');

    await expect(generateImage('bad prompt')).rejects.toThrow('Gemini API failed [400]');
  });

  test('blocked prompt throws', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [],
        promptFeedback: { blockReason: 'SAFETY' },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [],
        promptFeedback: { blockReason: 'SAFETY' },
      }),
    });

    vi.stubGlobal('fetch', mockFetch);
    const { generateImage } = await import('../lib/google-image');

    await expect(generateImage('blocked')).rejects.toThrow('Gemini blocked prompt: SAFETY');
  });

  test('missing GEMINI_API_KEY throws', async () => {
    delete process.env.GEMINI_API_KEY;

    const { generateImage } = await import('../lib/google-image');
    await expect(generateImage('test')).rejects.toThrow('GEMINI_API_KEY');
  });

  test('missing CLOUDFLARE_IMAGES_API_TOKEN throws', async () => {
    delete process.env.CLOUDFLARE_IMAGES_API_TOKEN;

    const { generateImage } = await import('../lib/google-image');
    await expect(generateImage('test')).rejects.toThrow('CLOUDFLARE_IMAGES_API_TOKEN');
  });

  test('retries once on failure', async () => {
    const mockFetch = vi.fn()
      // First attempt: fails
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal error',
      })
      // Retry: succeeds
      .mockResolvedValueOnce(geminiImageResponse())
      .mockResolvedValueOnce(cfUploadResponse('cf-retry'));

    vi.stubGlobal('fetch', mockFetch);
    const { generateImage } = await import('../lib/google-image');

    const result = await generateImage('retry test');
    expect(result.imageId).toBe('cf-retry');
    // Should have called fetch 3 times: fail, succeed, CF upload
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
