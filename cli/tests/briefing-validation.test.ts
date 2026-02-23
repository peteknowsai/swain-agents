import { describe, it, expect } from 'vitest';
import { validateItems } from '../lib/briefing-schema';

describe('briefing item validation', () => {
  it('accepts valid greeting + card + closing', () => {
    const result = validateItems([
      { type: 'greeting', content: 'Morning!' },
      { type: 'card', id: 'card_abc123' },
      { type: 'closing', content: 'Have a great day!' },
    ]);
    expect(result.success).toBe(true);
  });

  it('accepts text items', () => {
    const result = validateItems([
      { type: 'text', content: 'Some commentary here' },
    ]);
    expect(result.success).toBe(true);
  });

  it('accepts photo_upload items', () => {
    const result = validateItems([
      { type: 'photo_upload', prompt: 'Send a photo of your boat' },
    ]);
    expect(result.success).toBe(true);
  });

  it('rejects unknown type', () => {
    const result = validateItems([
      { type: 'banana', content: 'nope' },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('unknown type "banana"');
    }
  });

  it('rejects text item using "text" field instead of "content"', () => {
    const result = validateItems([
      { type: 'text', text: 'wrong field' },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain('"content", not "text"');
    }
  });

  it('rejects card item with cardId instead of id', () => {
    const result = validateItems([
      { type: 'card', cardId: 'card_abc123' },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain('"id", not "cardId"');
    }
  });

  it('rejects card with id not starting with card_', () => {
    const result = validateItems([
      { type: 'card', id: 'abc123' },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain('card_');
    }
  });

  it('rejects empty content string', () => {
    const result = validateItems([
      { type: 'greeting', content: '' },
    ]);
    expect(result.success).toBe(false);
  });

  it('reports multiple errors with correct indices', () => {
    const result = validateItems([
      { type: 'text', content: 'valid' },
      { type: 'bogus' },
      { type: 'text', content: 'also valid' },
      { type: 'card' }, // missing id
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBe(2);
      expect(result.errors[0]).toContain('[1]');
      expect(result.errors[1]).toContain('[3]');
    }
  });

  it('accepts a full realistic briefing', () => {
    const result = validateItems([
      { type: 'greeting', content: 'Morning, Bobby! Great day to get out on the water.' },
      { type: 'text', content: 'Conditions look perfect for your usual run.' },
      { type: 'card', id: 'card_weather_123' },
      { type: 'text', content: 'The redfish have been active near the mangroves.' },
      { type: 'card', id: 'card_fishing_456' },
      { type: 'card', id: 'card_boatart_789' },
      { type: 'closing', content: 'Have a great day on the water!' },
    ]);
    expect(result.success).toBe(true);
  });
});
