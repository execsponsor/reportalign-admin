/**
 * B1.4 — every registered HTTP route must authenticate.
 *
 * Every route in this app registers with `authLevel: 'anonymous'` and there is no platform-level
 * gating, so authentication is enforced purely by each handler doing it. This test removes the
 * "purely by convention" part: it enumerates what is ACTUALLY registered at runtime and fails if
 * anything is reachable without the withSuperAdmin wrapper.
 *
 * Routes are discovered dynamically by stubbing @azure/functions and importing every module in
 * src/functions — never from a hardcoded list — so an endpoint added tomorrow is covered the day
 * it is written, which is the whole point.
 */
import fs from 'fs';
import path from 'path';

/** Routes that are deliberately unauthenticated. Each needs a stated reason. */
const PUBLIC_ROUTE_ALLOWLIST: Record<string, string> = {
  healthCheck: 'Liveness probe. Returns a literal status object; touches no tenant data.',
  ping: 'Connectivity check. Returns a literal string; touches no tenant data.',
};

interface Registration {
  name: string;
  methods: string[];
  authLevel: string;
  route?: string;
  handler: unknown;
}

// Name must start with "mock": jest hoists the jest.mock factory above this declaration
// and refuses out-of-scope references that are not so prefixed.
const mockRegistrations: Registration[] = [];

// Stub the platform SDK so importing a function module records its registration instead of
// starting a host.
jest.mock('@azure/functions', () => ({
  app: {
    http: (name: string, options: Record<string, unknown>) => {
      mockRegistrations.push({
        name,
        methods: (options.methods as string[]) ?? [],
        authLevel: options.authLevel as string,
        route: options.route as string | undefined,
        handler: options.handler,
      });
    },
  },
}));

const SUPER_ADMIN_WRAPPED = Symbol.for('execsponsor.superAdminWrapped');
const FUNCTIONS_DIR = path.join(__dirname, '..', 'src', 'functions');

beforeAll(() => {
  const files = fs.readdirSync(FUNCTIONS_DIR).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require(path.join(FUNCTIONS_DIR, file));
  }
});

describe('HTTP route registration guard', () => {
  it('discovers the route surface (guards against a vacuous pass)', () => {
    // If the stub or the import loop breaks, every assertion below would pass trivially.
    expect(mockRegistrations.length).toBeGreaterThanOrEqual(35);
  });

  it('every registered route is either wrapped with withSuperAdmin or explicitly allowlisted', () => {
    const unprotected = mockRegistrations.filter(
      (r) =>
        !(r.handler as Record<symbol, unknown>)?.[SUPER_ADMIN_WRAPPED] &&
        !(r.name in PUBLIC_ROUTE_ALLOWLIST)
    );

    expect(
      unprotected.map((r) => `${r.methods.join('/')} ${r.route ?? r.name} [${r.name}]`)
    ).toEqual([]);
  });

  it('every allowlisted route is actually registered (stops the allowlist rotting)', () => {
    const names = new Set(mockRegistrations.map((r) => r.name));
    const stale = Object.keys(PUBLIC_ROUTE_ALLOWLIST).filter((n) => !names.has(n));
    expect(stale).toEqual([]);
  });

  it('the allowlist stays small and every entry carries a reason', () => {
    // A growing allowlist is how this control dies quietly.
    expect(Object.keys(PUBLIC_ROUTE_ALLOWLIST).length).toBeLessThanOrEqual(3);
    for (const [route, reason] of Object.entries(PUBLIC_ROUTE_ALLOWLIST)) {
      expect(reason.length).toBeGreaterThan(20); // a real sentence, not "ok"
      expect(route).toBeTruthy();
    }
  });

  it('mutating routes are wrapped without exception', () => {
    const mutating = mockRegistrations.filter((r) =>
      r.methods.some((m) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m.toUpperCase()))
    );
    expect(mutating.length).toBeGreaterThan(0); // anti-vacuity

    const unwrapped = mutating.filter(
      (r) => !(r.handler as Record<symbol, unknown>)?.[SUPER_ADMIN_WRAPPED]
    );
    expect(unwrapped.map((r) => `${r.methods.join('/')} ${r.route ?? r.name}`)).toEqual([]);
  });
});
