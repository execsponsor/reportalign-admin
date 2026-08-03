/**
 * Simple IP-based rate limiter for super-admin endpoints.
 * In-memory Map store — resets on function app restart.
 * Applied to destructive operations (POST/PUT/DELETE).
 */

import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { extractOriginIp } from '../utils/clientIp';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100;

const ipMap = new Map<string, RateLimitEntry>();

// Periodic cleanup to avoid unbounded growth.
//
// .unref() matters: this runs at MODULE scope, so merely importing this file starts a timer that
// keeps the Node event loop alive forever. Any process that imports it — the CI test run, a
// script, a one-off — then never exits on its own. That is exactly what happened: `npm test` hung
// until the job timeout cancelled it, and it went unnoticed locally because every manual run used
// --forceExit. An unref'd interval still fires while the app is running, but stops holding the
// process open once there is nothing else to do, which is the behaviour a cleanup timer wants.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipMap) {
    if (now > entry.resetAt) {
      ipMap.delete(ip);
    }
  }
}, WINDOW_MS);
cleanupTimer.unref();

/**
 * B6 (finding A7) — key on a platform-set address, not on client input.
 *
 * This previously read `x-forwarded-for`'s FIRST element, then fell back to `x-client-ip` and
 * `client-ip`. All three are attacker-controlled: a caller sets the header, the infrastructure
 * appends the real address AFTER it, and element [0] is whatever the caller chose. Rotating that
 * value defeated the limiter completely. It now shares extractOriginIp() with the audit log, which
 * prefers headers Front Door overwrites on ingress and otherwise takes the LAST forwarded hop.
 *
 * REMAINING LIMITATION, deliberately not fixed here: the store is an in-process Map, so each
 * Function App instance counts separately and every counter resets on restart. Under scale-out
 * the effective limit is (instances x 100) per minute rather than 100. That is acceptable only
 * because this sits behind Entra authentication and is a secondary control — it must not be
 * relied on as a primary defence. Making it shared means an external store (Redis or equivalent),
 * which is out of proportion to the risk here.
 */
function getClientIp(req: HttpRequest): string {
  return extractOriginIp(req).ip ?? 'unknown';
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
