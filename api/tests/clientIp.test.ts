/**
 * A5 / A7 — the origin address must not be attacker-controllable.
 *
 * These are the cases that made the old implementation evadable, written as tests so the
 * behaviour cannot quietly regress to "first element of x-forwarded-for".
 */
import { extractOriginIp, stripPort } from '../src/utils/clientIp';

/** Minimal HttpRequest stand-in — only `headers` is touched. */
function reqWith(headers: Record<string, string>) {
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { headers: { get: (k: string) => map.get(k.toLowerCase()) ?? null, keys: () => map.keys() } } as never;
}

describe('extractOriginIp', () => {
  it('prefers the platform header over anything the client sent', () => {
    const r = extractOriginIp(reqWith({
      'x-azure-clientip': '20.1.2.3',
      'x-forwarded-for': '6.6.6.6, 20.1.2.3',
      'x-client-ip': '6.6.6.6',
    }));
    expect(r.ip).toBe('20.1.2.3');
    expect(r.source).toBe('x-azure-clientip');
  });

  it('ignores x-client-ip and client-ip entirely — they are pure client input', () => {
    const r = extractOriginIp(reqWith({ 'x-client-ip': '6.6.6.6', 'client-ip': '6.6.6.7' }));
    expect(r.ip).toBeNull();
    expect(r.source).toBe('none');
  });

  it('takes the LAST forwarded hop, not the first — the first is the spoofed one', () => {
    // A caller sends "X-Forwarded-For: 6.6.6.6"; the infrastructure appends what it observed.
    // Reading element [0] reads the attacker's value, which is what the old code did.
    const r = extractOriginIp(reqWith({ 'x-forwarded-for': '6.6.6.6, 10.0.0.1, 20.1.2.3' }));
    expect(r.ip).toBe('20.1.2.3');
    expect(r.ip).not.toBe('6.6.6.6');
    expect(r.source).toBe('x-forwarded-for[last]');
  });

  it('rotating a spoofed header cannot change the key the rate limiter uses', () => {
    // The evasion the old limiter allowed: change the header, get a fresh bucket.
    const a = extractOriginIp(reqWith({ 'x-forwarded-for': '1.1.1.1, 20.1.2.3' }));
    const b = extractOriginIp(reqWith({ 'x-forwarded-for': '2.2.2.2, 20.1.2.3' }));
    const c = extractOriginIp(reqWith({ 'x-forwarded-for': '3.3.3.3, 20.1.2.3' }));
    expect(new Set([a.ip, b.ip, c.ip]).size).toBe(1);
  });

  it('returns null rather than a guess when nothing trustworthy is present', () => {
    expect(extractOriginIp(reqWith({})).ip).toBeNull();
  });
});

describe('stripPort', () => {
  // Azure appends the client port to forwarded addresses; Postgres `inet` rejects "1.2.3.4:5678".
  // This is the same defect that once broke login on the main backend.
  it.each([
    ['20.1.2.3:56789', '20.1.2.3'],
    ['20.1.2.3', '20.1.2.3'],
    ['[2603:1030::1]:443', '2603:1030::1'],
    ['2603:1030::1', '2603:1030::1'],
  ])('%s -> %s', (input, expected) => {
    expect(stripPort(input)).toBe(expected);
  });

  it('a port-suffixed address is accepted by Postgres inet only after stripping', () => {
    // Guards the reason this exists: the raw value is not a valid inet literal.
    expect(stripPort('20.1.2.3:56789')).not.toContain(':');
  });
});
