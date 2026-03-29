/**
 * Entra ID authentication middleware for Azure Functions
 *
 * Entra ID issues HS256-signed access tokens for same-tenant SPA→API flows.
 * These are verified using the API app's client secret as the symmetric key.
 * This is cryptographically secure — the secret never leaves the server.
 */

import { HttpRequest, InvocationContext } from '@azure/functions';
import jwt from 'jsonwebtoken';
import { getPool } from '../utils/database';

interface AuthResult {
  authenticated: boolean;
  superAdminId?: string;
  userId?: string;
  email?: string;
  error?: string;
}

// API app registration (separate from the SPA app)
const API_APP_ID = process.env.ENTRA_API_APP_ID || 'cde2b783-c437-4758-9308-d9474e27bc39';

/**
 * Verify the Entra ID access token and check super_admin status
 */
export async function authenticateSuperAdmin(
  req: HttpRequest,
  context: InvocationContext
): Promise<AuthResult> {
  // Use custom header — SWA proxy replaces the Authorization header with its own internal token
  const token = req.headers.get('x-admin-token');

  if (!token) {
    return { authenticated: false, error: 'Missing X-Admin-Token header' };
  }

  try {
    const apiSecret = process.env.ENTRA_API_CLIENT_SECRET;
    if (!apiSecret) {
      return { authenticated: false, error: 'API client secret not configured' };
    }

    // Verify HS256 token using API app's client secret
    const decoded = jwt.verify(token, apiSecret, {
      algorithms: ['HS256'],
      audience: API_APP_ID,
      issuer: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/v2.0`,
    }) as jwt.JwtPayload;

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
    const debugPayload = jwt.decode(token) as Record<string, unknown> | null;
    const debugHeader = jwt.decode(token, { complete: true })?.header;
    return {
      authenticated: false,
      error: `Auth failed: ${message}`,
      debug: {
        tokenAlg: debugHeader?.alg,
        tokenTyp: debugHeader?.typ,
        aud: debugPayload?.aud,
        iss: debugPayload?.iss,
        preferred_username: debugPayload?.preferred_username,
        secretLength: apiSecret?.length,
        secretPrefix: apiSecret?.substring(0, 4),
        nodeVersion: process.version,
        jwtVersion: require('jsonwebtoken/package.json').version,
      },
    } as AuthResult;
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
