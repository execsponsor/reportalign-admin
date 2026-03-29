/**
 * Entra ID authentication middleware for Azure Functions
 *
 * Verifies access tokens issued by Entra ID for the API app registration.
 * Uses the jose library for JWT verification (handles HS256/RS256 correctly).
 */

import { HttpRequest, InvocationContext } from '@azure/functions';
import { jwtVerify, createLocalJWKSet, createRemoteJWKSet, importJWK } from 'jose';
import { getPool } from '../utils/database';

interface AuthResult {
  authenticated: boolean;
  superAdminId?: string;
  userId?: string;
  email?: string;
  error?: string;
}

const API_APP_ID = process.env.ENTRA_API_APP_ID || 'cde2b783-c437-4758-9308-d9474e27bc39';

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

  const apiSecret = process.env.ENTRA_API_CLIENT_SECRET;
  if (!apiSecret) {
    return { authenticated: false, error: 'API client secret not configured' };
  }

  try {
    // Import the client secret as an HS256 key
    const secret = new TextEncoder().encode(apiSecret);

    const { payload } = await jwtVerify(token, secret, {
      audience: API_APP_ID,
      issuer: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/v2.0`,
    });

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
