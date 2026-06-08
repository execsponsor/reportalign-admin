/**
 * Entra ID authentication middleware for Azure Functions
 *
 * Verifies access tokens issued by Entra ID for the API app registration.
 * Uses the jose library for JWT verification (handles HS256/RS256 correctly).
 */

import { HttpRequest, InvocationContext } from '@azure/functions';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { getPool } from '../utils/database';

interface AuthResult {
  authenticated: boolean;
  superAdminId?: string;
  userId?: string;
  email?: string;
  error?: string;
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

    return {
      authenticated: true,
      superAdminId: sa.super_admin_id,
      userId: sa.user_id,
      email,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    context.error('Auth error:', message);
    return { authenticated: false, error: `Auth failed: ${message}` };
  }
}

/**
 * Log an audit action
 */
export async function logAuditAction(
  superAdminId: string,
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
     (super_admin_id, action_type, target_type, target_id, before_value, after_value, reason, session_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      superAdminId,
      actionType,
      targetType,
      targetId,
      beforeValue ? JSON.stringify(beforeValue) : null,
      afterValue ? JSON.stringify(afterValue) : null,
      reason || null,
      crypto.randomUUID(),
    ]
  );
}
