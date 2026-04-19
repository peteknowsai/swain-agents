import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock env vars before importing the module
beforeEach(() => {
  process.env.REPLICATE_API_TOKEN = 'test-replicate-token';
  process.env.CLOUDFLARE_ACCOUNT_ID = 'test-cf-account';
  process.env.CLOUDFLARE_IMAGES_API_TOKEN = 'test-cf-images-token';
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.REPLICATE_API_TOKEN;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_IMAGES_API_TOKEN;
});

const MODEL_URL = 'https://api.replicate.com/v1/models/google/nano-banana-2/predictions';

describe('generateImage', () => {
  test('sync response — flat array output', async () => {
    const mockFetch = vi.fn()
      // Replicate create prediction
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pred_123',
          status: 'succeeded',
          output: ['https://replicate.delivery/image.jpg'],
        }),
      })
      // Download image
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })
      // Upload to Cloudflare
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: { id: 'cf-img-123', variants: ['https://imagedelivery.net/abc/cf-img-123/public'] },
        }),
      });

    vi.stubGlobal('fetch', mockFetch);
    const { generateImage } = await import('../lib/replicate-image');

    const result = await generateImage('test prompt');

    expect(result.replicateId).toBe('pred_123');
    expect(result.imageId).toBe('cf-img-123');
    expect(result.url).toContain('cf-img-123');

    // Verify the Replicate request used NB2 URL
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe(MODEL_URL);
    const body = JSON.parse(opts.body);
    expect(body.input.prompt).toBe('test prompt');
    expect(body.input.resolution).toBe('1K');
  });

  test('sync response — NB2 object output { images: [{ url }] }', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pred_456',
          status: 'succeeded',
          output: { images: [{ url: 'https://replicate.delivery/nb2-image.jpg' }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: { id: 'cf-img-456', variants: [] },
        }),
      });

    vi.stubGlobal('fetch', mockFetch);
    const { generateImage } = await import('../lib/replicate-image');

    const result = await generateImage('test prompt');
    expect(result.replicateId).toBe('pred_456');
    expect(result.imageId).toBe('cf-img-456');
  });

  test('poll response — extracts URL after polling', async () => {
    const mockFetch = vi.fn()
      // Initial: still processing
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pred_789',
          status: 'processing',
          urls: { get: 'https://api.replicate.com/v1/predictions/pred_789' },
        }),
      })
      // Poll: succeeded
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pred_789',
          status: 'succeeded',
          output: ['https://replicate.delivery/polled.jpg'],
        }),
      })
      // Download
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })
      // CF upload
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: { id: 'cf-poll', variants: [] },
        }),
      });

    vi.stubGlobal('fetch', mockFetch);
    const { generateImage } = await import('../lib/replicate-image');

    const result = await generateImage('poll test');
    expect(result.replicateId).toBe('pred_789');
    expect(result.imageId).toBe('cf-poll');
  });

  test('failed prediction throws', async () => {
    // generateImage retries runReplicate once, so mock both attempts
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'pred_fail',
        status: 'failed',
        error: 'NSFW content detected',
      }),
    });

    vi.stubGlobal('fetch', mockFetch);
    const { generateImage } = await import('../lib/replicate-image');

    await expect(generateImage('bad prompt')).rejects.toThrow('NSFW content detected');
  }, 10_000);

  test('missing REPLICATE_API_TOKEN throws', async () => {
    delete process.env.REPLICATE_API_TOKEN;

    const { generateImage } = await import('../lib/replicate-image');
    await expect(generateImage('test')).rejects.toThrow('REPLICATE_API_TOKEN');
  });

  test('missing CLOUDFLARE_IMAGES_API_TOKEN throws', async () => {
    delete process.env.CLOUDFLARE_IMAGES_API_TOKEN;

    const { generateImage } = await import('../lib/replicate-image');
    await expect(generateImage('test')).rejects.toThrow('CLOUDFLARE_IMAGES_API_TOKEN');
  });

  test('resolution param is passed to API body', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pred_res',
          status: 'succeeded',
          output: ['https://replicate.delivery/res.jpg'],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: { id: 'cf-res', variants: [] },
        }),
      });

    vi.stubGlobal('fetch', mockFetch);
    const { generateImage } = await import('../lib/replicate-image');

    await generateImage('test', { resolution: '4K' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.input.resolution).toBe('4K');
  });

  test('custom aspect ratio reaches API body', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pred_ar',
          status: 'succeeded',
          output: ['https://replicate.delivery/ar.jpg'],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: { id: 'cf-ar', variants: [] },
        }),
      });

    vi.stubGlobal('fetch', mockFetch);
    const { generateImage } = await import('../lib/replicate-image');

    await generateImage('test', { aspectRatio: '16:9' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.input.aspect_ratio).toBe('16:9');
  });
});
