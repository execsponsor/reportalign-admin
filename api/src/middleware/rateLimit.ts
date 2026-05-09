/**
 * Simple IP-based rate limiter for super-admin endpoints.
 * In-memory Map store — resets on function app restart.
 * Applied to destructive operations (POST/PUT/DELETE).
 */

import { HttpRequest, HttpResponseInit } from '@azure/functions';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100;

const ipMap = new Map<string, RateLimitEntry>();

// Periodic cleanup to avoid unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipMap) {
    if (now > entry.resetAt) {
      ipMap.delete(ip);
    }
  }
}, WINDOW_MS);

function getClientIp(req: HttpRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-client-ip') ||
    req.headers.get('client-ip') ||
    'unknown'
  );
}

/**
 * Check rate limit for the request. Returns an error response if the limit
 * is exceeded, or null if the request is allowed to proceed.
 */
export function checkRateLimit(req: HttpRequest): HttpResponseInit | null {
  // Only limit destructive methods
  const method = req.method.toUpperCase();
  if (method !== 'POST' && method !== 'PUT' && method !== 'DELETE' && method !== 'PATCH') {
    return null;
  }

  const ip = getClientIp(req);
  const now = Date.now();
  let entry = ipMap.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    ipMap.set(ip, entry);
    return null;
  }

  entry.count++;

  if (entry.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
      jsonBody: { success: false, error: 'Too many requests. Please try again later.' },
    };
  }

  return null;
}
