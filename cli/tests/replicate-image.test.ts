import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

const tinyPngB64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const generateMock = vi.fn();
const editMock = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    images: { generate: generateMock, edit: editMock },
  })),
}));

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.CLOUDFLARE_ACCOUNT_ID = 'test-cf-account';
  process.env.CLOUDFLARE_IMAGES_API_TOKEN = 'test-cf-images-token';
  generateMock.mockReset();
  editMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENAI_API_KEY;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_IMAGES_API_TOKEN;
});

function mockCloudflareOk(cfId = 'cf-img-123') {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      result: { id: cfId, variants: [`https://imagedelivery.net/abc/${cfId}/public`] },
    }),
  });
}

describe('generateImage (OpenAI gpt-image-2)', () => {
  test('text-to-image happy path', async () => {
    generateMock.mockResolvedValueOnce({
      created: 1700000000,
      data: [{ b64_json: tinyPngB64 }],
    });
    vi.stubGlobal('fetch', mockCloudflareOk('cf-t2i'));

    const { generateImage } = await import('../lib/replicate-image');
    const result = await generateImage('test prompt');

    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(editMock).not.toHaveBeenCalled();
    const args = generateMock.mock.calls[0][0];
    expect(args.model).toBe('gpt-image-2');
    expect(args.prompt).toBe('test prompt');
    expect(args.size).toBe('1024x1024');
    expect(args.quality).toBe('medium');
    expect(args.n).toBe(1);

    expect(result.imageId).toBe('cf-t2i');
    expect(result.url).toContain('cf-t2i');
    expect(result.replicateId).toBe('1700000000');
  });

  test('img2img uses edits endpoint and fetches the source image', async () => {
    editMock.mockResolvedValueOnce({
      created: 1700000001,
      data: [{ b64_json: tinyPngB64 }],
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        headers: { get: () => 'image/jpeg' },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: { id: 'cf-i2i', variants: [] },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { generateImage } = await import('../lib/replicate-image');
    const result = await generateImage('restyle this', {
      imageInputUrl: 'https://example.com/src.jpg',
      aspectRatio: '16:9',
    });

    expect(editMock).toHaveBeenCalledTimes(1);
    expect(generateMock).not.toHaveBeenCalled();
    const args = editMock.mock.calls[0][0];
    expect(args.model).toBe('gpt-image-2');
    expect(args.size).toBe('1536x1024');
    expect(args.quality).toBe('medium');
    expect(args.image).toBeInstanceOf(File);
    expect(result.imageId).toBe('cf-i2i');
  });

  test('missing OPENAI_API_KEY throws', async () => {
    delete process.env.OPENAI_API_KEY;
    const { generateImage } = await import('../lib/replicate-image');
    await expect(generateImage('test')).rejects.toThrow('OPENAI_API_KEY');
  });

  test('missing CLOUDFLARE_IMAGES_API_TOKEN throws', async () => {
    delete process.env.CLOUDFLARE_IMAGES_API_TOKEN;
    const { generateImage } = await import('../lib/replicate-image');
    await expect(generateImage('test')).rejects.toThrow('CLOUDFLARE_IMAGES_API_TOKEN');
  });

  test('OpenAI failure retries once then throws', async () => {
    generateMock
      .mockRejectedValueOnce(new Error('rate limit exceeded'))
      .mockRejectedValueOnce(new Error('rate limit exceeded'));
    vi.stubGlobal('fetch', mockCloudflareOk());

    const { generateImage } = await import('../lib/replicate-image');
    await expect(generateImage('test')).rejects.toThrow('rate limit exceeded');
    expect(generateMock).toHaveBeenCalledTimes(2);
  }, 10_000);

  test('resolution=4K maps to quality=high', async () => {
    generateMock.mockResolvedValueOnce({
      created: 1,
      data: [{ b64_json: tinyPngB64 }],
    });
    vi.stubGlobal('fetch', mockCloudflareOk());
    const { generateImage } = await import('../lib/replicate-image');
    await generateImage('test', { resolution: '4K' });
    expect(generateMock.mock.calls[0][0].quality).toBe('high');
  });

  test('resolution=2K maps to quality=high', async () => {
    generateMock.mockResolvedValueOnce({
      created: 1,
      data: [{ b64_json: tinyPngB64 }],
    });
    vi.stubGlobal('fetch', mockCloudflareOk());
    const { generateImage } = await import('../lib/replicate-image');
    await generateImage('test', { resolution: '2K' });
    expect(generateMock.mock.calls[0][0].quality).toBe('high');
  });

  test('resolution=1K (default) maps to quality=medium', async () => {
    generateMock.mockResolvedValueOnce({
      created: 1,
      data: [{ b64_json: tinyPngB64 }],
    });
    vi.stubGlobal('fetch', mockCloudflareOk());
    const { generateImage } = await import('../lib/replicate-image');
    await generateImage('test', { resolution: '1K' });
    expect(generateMock.mock.calls[0][0].quality).toBe('medium');
  });

  test('aspect 16:9 → size 1536x1024 (landscape)', async () => {
    generateMock.mockResolvedValueOnce({
      created: 1,
      data: [{ b64_json: tinyPngB64 }],
    });
    vi.stubGlobal('fetch', mockCloudflareOk());
    const { generateImage } = await import('../lib/replicate-image');
    await generateImage('test', { aspectRatio: '16:9' });
    expect(generateMock.mock.calls[0][0].size).toBe('1536x1024');
  });

  test('aspect 9:16 → size 1024x1536 (portrait)', async () => {
    generateMock.mockResolvedValueOnce({
      created: 1,
      data: [{ b64_json: tinyPngB64 }],
    });
    vi.stubGlobal('fetch', mockCloudflareOk());
    const { generateImage } = await import('../lib/replicate-image');
    await generateImage('test', { aspectRatio: '9:16' });
    expect(generateMock.mock.calls[0][0].size).toBe('1024x1536');
  });

  test('aspect 1:1 → size 1024x1024', async () => {
    generateMock.mockResolvedValueOnce({
      created: 1,
      data: [{ b64_json: tinyPngB64 }],
    });
    vi.stubGlobal('fetch', mockCloudflareOk());
    const { generateImage } = await import('../lib/replicate-image');
    await generateImage('test', { aspectRatio: '1:1' });
    expect(generateMock.mock.calls[0][0].size).toBe('1024x1024');
  });
});

describe('aspectToSize mapper', () => {
  test('extreme aspects still bucket to one of the 3 sizes', async () => {
    const { aspectToSize } = await import('../lib/replicate-image');
    expect(aspectToSize(undefined)).toBe('1024x1024');
    expect(aspectToSize('1:1')).toBe('1024x1024');
    expect(aspectToSize('square')).toBe('1024x1024');
    expect(aspectToSize('4:3')).toBe('1536x1024');
    expect(aspectToSize('3:2')).toBe('1536x1024');
    expect(aspectToSize('16:9')).toBe('1536x1024');
    expect(aspectToSize('21:9')).toBe('1536x1024');
    expect(aspectToSize('8:1')).toBe('1536x1024');
    expect(aspectToSize('4:1')).toBe('1536x1024');
    expect(aspectToSize('2:3')).toBe('1024x1536');
    expect(aspectToSize('3:4')).toBe('1024x1536');
    expect(aspectToSize('4:5')).toBe('1024x1536');
    expect(aspectToSize('9:16')).toBe('1024x1536');
    expect(aspectToSize('match_input_image')).toBe('auto');
    expect(aspectToSize('auto')).toBe('auto');
    expect(aspectToSize('garbage')).toBe('1024x1024');
  });

  test('near-square (5% tolerance) still buckets as square', async () => {
    const { aspectToSize } = await import('../lib/replicate-image');
    expect(aspectToSize('100:102')).toBe('1024x1024');
  });
});

describe('resolutionToQuality mapper', () => {
  test('tier mapping', async () => {
    const { resolutionToQuality } = await import('../lib/replicate-image');
    expect(resolutionToQuality(undefined)).toBe('medium');
    expect(resolutionToQuality('0.5K')).toBe('medium');
    expect(resolutionToQuality('1K')).toBe('medium');
    expect(resolutionToQuality('2K')).toBe('high');
    expect(resolutionToQuality('4K')).toBe('high');
  });
});
