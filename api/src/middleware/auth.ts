/**
 * Entra ID authentication middleware for Azure Functions
 *
 * Verifies access tokens issued by Entra ID for the API app registration.
 * Uses the jose library for JWT verification (handles HS256/RS256 correctly).
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { getPool } from '../utils/database';
import { checkRateLimit } from './rateLimit';
import { extractOriginIp } from '../utils/clientIp';

interface AuthResult {
  authenticated: boolean;
  superAdminId?: string;
  userId?: string;
  email?: string;
  error?: string;
  /** A6 — Entra session id for correlating one administrator's actions. Null when unavailable. */
  sessionId?: string | null;
  /** A5 — origin address, platform-set headers only. Null when none was trustworthy. */
  ipAddress?: string | null;
  /** Which header the address came from; surfaced so the header assumption can be confirmed. */
  ipSource?: string;
}

let _jwksClient: jwksClient.JwksClient | undefined;

function getJwksClient(): jwksClient.JwksClient {
  if (!_jwksClient) {
    _jwksClient = jwksClient({
      jwksUri: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/discovery/v2.0/keys`,
      cache: true,
      rateLimit: true,
    });
  }
  return _jwksClient;
}

function getSigningKey(header: jwt.JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    getJwksClient().getSigningKey(header.kid, (err, key) => {
      if (err) { return reject(err); }
      resolve(key!.getPublicKey());
    });
  });
}

function verifyToken(token: string): Promise<jwt.JwtPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, (header, callback) => {
      getSigningKey(header).then(key => callback(null, key)).catch(err => callback(err));
    }, {
      audience: process.env.ENTRA_API_APP_ID,
      issuer: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/v2.0`,
      algorithms: ['RS256'],
    }, (err, decoded) => {
      if (err) { return reject(err); }
      resolve(decoded as jwt.JwtPayload);
    });
  });
}

/**
 * Verify the Entra ID access token and check super_admin status
 */
export async function authenticateSuperAdmin(
  req: HttpRequest,
  context: InvocationContext
): Promise<AuthResult> {
  // Use custom header — SWA proxy replaces the Authorization header
  const token = req.headers.get('x-admin-token');

  if (!token) {
    return { authenticated: false, error: 'Missing X-Admin-Token header' };
  }

  try {
    // Verify RS256 token using Entra ID JWKS
    const payload = await verifyToken(token);

    const email = ((payload.preferred_username || payload.email || payload.upn) as string || '').toLowerCase();

    if (!email) {
      return { authenticated: false, error: 'No email in token claims' };
    }

    // Check super_admin status in database
    const pool = getPool();
    const result = await pool.query(
      `SELECT sa.id as super_admin_id, sa.access_level, sa.is_active as sa_active,
              u.id as user_id, u.is_active as user_active
       FROM super_administrators sa
       JOIN users u ON sa.user_id = u.id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      const redactedEmail = email.replace(/(.{2}).+(@.+)/, '$1***$2');
      context.warn(`Non-super-admin login attempt: ${redactedEmail}`);
      return { authenticated: false, error: 'Not a super administrator' };
    }

    const sa = result.rows[0];

    if (!sa.sa_active || !sa.user_active) {
      return { authenticated: false, error: 'Super admin account is deactivated' };
    }

    // Update last login
    await pool.query(
      'UPDATE super_administrators SET last_login = NOW() WHERE id = $1',
      [sa.super_admin_id]
    );

    const { ip, source } = extractOriginIp(req);
    if (!ip) {
      // Records which headers were present so the unverified assumption above can be settled
      // from a real request rather than from documentation.
      context.warn(
        `[audit] no trustworthy origin header; saw: ${[...req.headers.keys()]
          .filter((h) => /ip|forwarded|azure/i.test(h))
          .join(', ') || '(none)'}`
      );
    }

    return {
      authenticated: true,
      superAdminId: sa.super_admin_id,
      userId: sa.user_id,
      email,
      sessionId: deriveSessionId(payload),
      ipAddress: ip,
      ipSource: source,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    context.error('Auth error:', message);
    return { authenticated: false, error: `Auth failed: ${message}` };
  }
}

/**
 * An authenticated caller. Same shape as AuthResult, but with the identity fields no longer
 * optional — inside a wrapped handler they are always present, so handlers stop writing `auth.superAdminId!`.
 */
export interface AuthenticatedSuperAdmin {
  authenticated: true;
  superAdminId: string;
  userId: string;
  email: string;
  /** Entra session identifier, for correlating one administrator's actions. Null if unavailable. */
  sessionId: string | null;
  /** Origin address, from a platform-set header only. Null if none was trustworthy. */
  ipAddress: string | null;
}

/**
 * A6 — a session identifier that can actually correlate a session.
 *
 * Entra ID issues `sid` when a session is available; it is stable for the life of that sign-in
 * and survives token refresh, which is precisely the grouping the column promises. `auth_time`
 * (when the user actually authenticated, as opposed to `iat`, when this token was minted) is the
 * fallback: hashing it with the subject gives a value stable across refreshes within one sign-in.
 *
 * Returns null when neither claim is present. The previous code generated a fresh random UUID per
 * record, which made the column look populated while being incapable of grouping anything — worse
 * than empty, because it invites trust.
 */
function deriveSessionId(payload: jwt.JwtPayload): string | null {
  const sid = payload.sid as string | undefined;
  if (sid) { return sid; }

  const authTime = (payload.auth_time as number | undefined) ?? undefined;
  const subject = (payload.sub as string | undefined) ?? undefined;
  if (authTime && subject) {
    return crypto.createHash('sha256').update(`${subject}:${authTime}`).digest('hex').slice(0, 32);
  }
  return null;
}


export type SuperAdminHandler = (
  req: HttpRequest,
  context: InvocationContext,
  auth: AuthenticatedSuperAdmin
) => Promise<HttpResponseInit>;

/**
 * B1 — apply authentication at REGISTRATION rather than inside each handler.
 *
 * Every route in this app registers with `authLevel: 'anonymous'` and there is no
 * platform-level route gating, so the only thing standing between the internet and a database
 * connection that bypasses row-level security is each handler remembering to call
 * authenticateSuperAdmin() on its first line. That was correct for 38 of 40 handlers — but the
 * failure mode is silent and severe: one new handler that forgets is immediately reachable,
 * unauthenticated, holding owner-level credentials. Nothing in the build or the platform
 * would catch it.
 *
 * Wrapping at registration makes the secure path the default. Authentication can then only be
 * removed deliberately (by not wrapping and adding the route to the allowlist in
 * functions/registrations.test.ts), not forgotten.
 *
 * `rateLimitFirst` preserves each handler's EXISTING order. Some handlers call checkRateLimit()
 * before authenticating and some after; flipping that silently would change which status code an
 * anonymous, over-limit caller receives. Callers keep the order they had.
 */
/** Marker the registration guard looks for. Set by withSuperAdmin, never by hand. */
export const SUPER_ADMIN_WRAPPED = Symbol.for('execsponsor.superAdminWrapped');

export function withSuperAdmin(
  handler: SuperAdminHandler,
  opts: { rateLimitFirst?: boolean } = {}
) {
  const wrapped = async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    if (opts.rateLimitFirst) {
      const limited = checkRateLimit(req);
      if (limited) { return limited; }
    }

    const auth = await authenticateSuperAdmin(req, context);
    if (!auth.authenticated) {
      // Byte-for-byte the response the handlers returned themselves.
      return { status: 401, jsonBody: { error: auth.error } };
    }

    return handler(req, context, auth as AuthenticatedSuperAdmin);
  };

  // A tag rather than a name/source check: the guard must not be fooled by a handler that merely
  // looks wrapped, and must not break when the bundler renames functions.
  Object.defineProperty(wrapped, SUPER_ADMIN_WRAPPED, { value: true, enumerable: false });
  return wrapped;
}

/**
 * Log an audit action
 */
export async function logAuditAction(
  auth: AuthenticatedSuperAdmin,
  actionType: string,
  targetType: string,
  targetId: string | null,
  beforeValue: Record<string, unknown> | null,
  afterValue: Record<string, unknown> | null,
  reason?: string
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO super_admin_audit_log
     (super_admin_id, action_type, target_type, target_id, before_value, after_value, reason, session_id, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      auth.superAdminId,
      actionType,
      targetType,
      targetId,
      beforeValue ? JSON.stringify(beforeValue) : null,
      afterValue ? JSON.stringify(afterValue) : null,
      reason || null,
      // A6: previously crypto.randomUUID() per record, so every action looked like a different
      // session and the column could not group anything — which is exactly what it appears to
      // promise. Now the Entra session identifier. NULL when the token carries neither `sid` nor
      // `auth_time`: a null that admits ignorance is worth more than a random value that lies.
      auth.sessionId ?? null,
      // A5: the column existed and was never written. Attribution to an account but not an
      // origin is the first thing missing in an incident.
      auth.ipAddress ?? null,
    ]
  );
}
