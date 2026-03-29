/**
 * Entra ID authentication middleware for Azure Functions
 * Verifies JWT tokens and checks super_admin role
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

// JWKS client for Entra ID token verification
const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback): void {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Verify the Entra ID token and check super_admin status
 */
export async function authenticateSuperAdmin(
  req: HttpRequest,
  context: InvocationContext
): Promise<AuthResult> {
  const authHeader = req.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Missing or invalid Authorization header' };
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT with Entra ID JWKS
    const decoded = await new Promise<jwt.JwtPayload>((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          audience: process.env.ENTRA_CLIENT_ID || process.env.ENTRA_AUDIENCE,
          issuer: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/v2.0`,
        },
        (err, decoded) => {
          if (err) reject(err);
          else resolve(decoded as jwt.JwtPayload);
        }
      );
    });

    const email = (decoded.preferred_username || decoded.email || decoded.upn || '').toLowerCase();

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
      context.warn(`Non-super-admin login attempt: ${email}`);
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
