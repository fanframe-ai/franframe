import { describe, expect, it } from 'vitest';
import { readEnvironment } from './env';

describe('public environment', () => {
  it('derives the project from the configured URL', () => {
    expect(readEnvironment({ VITE_SUPABASE_URL: 'https://example.supabase.co/', VITE_SUPABASE_PUBLISHABLE_KEY: 'public' }))
      .toEqual({ supabaseUrl: 'https://example.supabase.co', supabaseKey: 'public', projectId: 'example' });
  });
  it('rejects missing or invalid configuration', () => {
    expect(() => readEnvironment({})).toThrow();
    expect(() => readEnvironment({ VITE_SUPABASE_URL: 'file:///tmp/db', VITE_SUPABASE_PUBLISHABLE_KEY: 'x' })).toThrow();
  });
});
