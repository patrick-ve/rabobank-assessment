import crypto from 'crypto';

// Simple in-memory cache for test responses
const responseCache = new Map<string, any>();

export function getCacheKey(model: string, prompt: string): string {
  return crypto
    .createHash('md5')
    .update(`${model}:${prompt}`)
    .digest('hex');
}

export function getCachedResponse(key: string): any | null {
  return responseCache.get(key) || null;
}

export function setCachedResponse(key: string, response: any): void {
  responseCache.set(key, response);
}

export function clearCache(): void {
  responseCache.clear();
}

// Enable caching only in test environment
export const isCachingEnabled = (): boolean => {
  return process.env.NODE_ENV === 'test' && process.env.ENABLE_TEST_CACHE === 'true';
};