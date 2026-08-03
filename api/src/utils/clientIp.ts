/**
 * Origin-address extraction, shared by the audit log (A5) and the rate limiter (A7).
 *
 * Lives in its own module rather than in auth.ts because the rate limiter needs it and auth.ts
 * already imports the rate limiter — putting it in either would make the two circular.
 *
 * WHAT MUST NOT BE USED, AND WHY
 *   `x-client-ip` and `client-ip` are pure client input with no platform involvement.
 *   `x-forwarded-for`'s FIRST element is equally untrustworthy: a caller sends
 *   `X-Forwarded-For: 1.2.3.4` and the infrastructure APPENDS the observed address after it, so
 *   reading element [0] reads the attacker's value. Both the old rate limiter and the unpopulated
 *   audit column would have inherited that flaw.
 *
 * WHAT IS USED
 *   Static Web Apps fronts these functions with Azure Front Door, which sets `x-azure-clientip`
 *   (the address AFD observed) and `x-azure-socketip` (the TCP peer), overwriting both on ingress
 *   so a client cannot forge them. Failing those, the LAST element of `x-forwarded-for` — the hop
 *   appended by the nearest trusted proxy.
 *
 * NOT VERIFIED BY OBSERVATION
 *   Which of these headers Static Web Apps actually delivers to a managed function was taken from
 *   documented Front Door behaviour, not confirmed against the live platform. `source` is returned
 *   so the caller can record which header was used and settle it from a real request.
 */
import { HttpRequest } from '@azure/functions';

const PLATFORM_IP_HEADERS = ['x-azure-clientip', 'x-azure-socketip'] as const;

export interface OriginIp {
  ip: string | null;
  source: string;
}

export function extractOriginIp(req: HttpRequest): OriginIp {
  for (const h of PLATFORM_IP_HEADERS) {
    const v = req.headers.get(h)?.trim();
    if (v) { return { ip: stripPort(v), source: h }; }
  }

  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length) {
      return { ip: stripPort(parts[parts.length - 1]), source: 'x-forwarded-for[last]' };
    }
  }

  return { ip: null, source: 'none' };
}

/**
 * Azure appends the client PORT to forwarded addresses (`1.2.3.4:56789`). Postgres `inet` rejects
 * that, which is the same defect that once broke login on the main backend — worth stripping here
 * rather than discovering it again when the audit insert starts failing.
 */
export function stripPort(value: string): string {
  const v = value.trim();
  if (v.startsWith('[')) {
    const end = v.indexOf(']');
    return end > 0 ? v.slice(1, end) : v;          // [::1]:443 -> ::1
  }
  const colons = (v.match(/:/g) || []).length;
  if (colons === 1) { return v.split(':')[0]; }    // 1.2.3.4:56789 -> 1.2.3.4
  return v;                                        // bare IPv6, or no port
}
