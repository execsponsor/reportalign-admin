/**
 * User Management Azure Functions
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateSuperAdmin, logAuditAction } from '../middleware/auth';
import { getPool } from '../utils/database';
import { generatePassword, hashPassword, hashEmail } from '../utils/crypto';
import { createUserSchema, paginationSchema } from '../utils/validation';
import { v4 as uuidv4 } from 'uuid';

// GET /api/users — List all users
async function listUsers(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const params = paginationSchema.parse(Object.fromEntries(req.query));
  const pool = getPool();
  const offset = (params.page - 1) * params.limit;

  let whereClause = 'WHERE 1=1';
  const queryParams: unknown[] = [];
  let paramIdx = 1;

  if (params.search) {
    whereClause += ` AND (u.email ILIKE $${paramIdx} OR u.first_name ILIKE $${paramIdx} OR u.last_name ILIKE $${paramIdx})`;
    queryParams.push(`%${params.search}%`);
    paramIdx++;
  }

  const countResult = await pool.query(`SELECT COUNT(*) as total FROM users u ${whereClause}`, queryParams);

  const usersResult = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, u.last_login, u.created_at,
            u.locked_until, u.failed_login_attempts,
            (SELECT json_agg(json_build_object('org_name', o.name, 'access_level', ou.access_level, 'role', ou.role))
             FROM organization_users ou JOIN organizations o ON ou.organization_id = o.id
             WHERE ou.user_id = u.id AND ou.is_active = true) as organizations
     FROM users u
     ${whereClause}
     ORDER BY u.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
    [...queryParams, params.limit, offset]
  );

  return {
    status: 200,
    jsonBody: {
      success: true,
      data: {
        users: usersResult.rows,
        pagination: {
          page: params.page,
          limit: params.limit,
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(parseInt(countResult.rows[0].total) / params.limit),
        },
      },
    },
  };
}

// GET /api/users/:id — View user details
async function getUser(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const id = req.params.id;
  const pool = getPool();

  const userResult = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, u.email_verified,
            u.last_login, u.created_at, u.locked_until, u.failed_login_attempts
     FROM users u WHERE u.id = $1 OR u.email = $1`,
    [id]
  );

  if (userResult.rows.length === 0) return { status: 404, jsonBody: { error: 'User not found' } };
  const user = userResult.rows[0];

  const orgsResult = await pool.query(
    `SELECT o.id, o.name, o.subdomain, ou.access_level, ou.role, ou.is_active, ou.created_at
     FROM organization_users ou JOIN organizations o ON ou.organization_id = o.id
     WHERE ou.user_id = $1 ORDER BY ou.created_at`,
    [user.id]
  );

  const programmesResult = await pool.query(
    `SELECT p.name, ptm.programme_role, p.id as programme_id
     FROM programme_team_members ptm JOIN programmes p ON ptm.programme_id = p.id
     WHERE ptm.user_id = $1 AND ptm.removed_at IS NULL
     ORDER BY p.name`,
    [user.id]
  );

  return {
    status: 200,
    jsonBody: {
      success: true,
      data: {
        ...user,
        organizations: orgsResult.rows,
        programmes: programmesResult.rows,
      },
    },
  };
}

// POST /api/users — Create user
async function createUser(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const body = await req.json() as Record<string, unknown>;
  const data = createUserSchema.parse(body);
  const pool = getPool();

  // Check email uniqueness
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [data.email]);
  if (existing.rows.length > 0) {
    return { status: 409, jsonBody: { error: 'Email already exists' } };
  }

  const userId = uuidv4();
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  const emailHash = hashEmail(data.email);

  await pool.query(
    `INSERT INTO users (id, email, password_hash, email_hash, first_name, last_name, is_active, email_verified)
     VALUES ($1, $2, $3, $4, $5, $6, true, true)`,
    [userId, data.email, passwordHash, emailHash, data.firstName, data.lastName]
  );

  await pool.query(
    `INSERT INTO organization_users (organization_id, user_id, access_level, role, is_active)
     VALUES ($1, $2, $3, $4, true)`,
    [data.organizationId, userId, data.accessLevel, data.accessLevel]
  );

  await logAuditAction(auth.superAdminId!, 'CREATE_USER', 'user', userId, null, {
    email: data.email, organizationId: data.organizationId, accessLevel: data.accessLevel,
  });

  return {
    status: 201,
    jsonBody: {
      success: true,
      data: { userId, email: data.email, password, accessLevel: data.accessLevel },
      message: 'User created. Save the password — it will not be shown again.',
    },
  };
}

// POST /api/users/:id/unlock — Unlock account
async function unlockUser(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const id = req.params.id;
  const pool = getPool();

  await pool.query(
    'UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE id = $1',
    [id]
  );

  await logAuditAction(auth.superAdminId!, 'UNLOCK_ACCOUNT', 'user', id, null, { unlocked: true });

  return { status: 200, jsonBody: { success: true, message: 'Account unlocked' } };
}

// POST /api/users/:id/reset-password — Reset password
async function resetPassword(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const id = req.params.id;
  const pool = getPool();
  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  await pool.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [passwordHash, id]
  );

  await logAuditAction(auth.superAdminId!, 'RESET_PASSWORD', 'user', id, null, { passwordReset: true });

  return {
    status: 200,
    jsonBody: {
      success: true,
      data: { password },
      message: 'Password reset. Save the new password — it will not be shown again.',
    },
  };
}

// POST /api/users/:id/deactivate — Deactivate
async function deactivateUser(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const id = req.params.id;
  const pool = getPool();

  await pool.query('UPDATE users SET is_active = false WHERE id = $1', [id]);
  await pool.query('UPDATE organization_users SET is_active = false WHERE user_id = $1', [id]);

  await logAuditAction(auth.superAdminId!, 'DEACTIVATE_USER', 'user', id, null, { deactivated: true });

  return { status: 200, jsonBody: { success: true, message: 'User deactivated' } };
}

// POST /api/users/:id/reactivate — Reactivate
async function reactivateUser(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const id = req.params.id;
  const pool = getPool();

  await pool.query('UPDATE users SET is_active = true WHERE id = $1', [id]);
  await pool.query('UPDATE organization_users SET is_active = true WHERE user_id = $1', [id]);

  await logAuditAction(auth.superAdminId!, 'REACTIVATE_USER', 'user', id, null, { reactivated: true });

  return { status: 200, jsonBody: { success: true, message: 'User reactivated' } };
}

// Register routes
app.http('listUsers', { methods: ['GET'], authLevel: 'anonymous', route: 'users', handler: listUsers });
app.http('getUser', { methods: ['GET'], authLevel: 'anonymous', route: 'users/{id}', handler: getUser });
app.http('createUser', { methods: ['POST'], authLevel: 'anonymous', route: 'users', handler: createUser });
app.http('unlockUser', { methods: ['POST'], authLevel: 'anonymous', route: 'users/{id}/unlock', handler: unlockUser });
app.http('resetPassword', { methods: ['POST'], authLevel: 'anonymous', route: 'users/{id}/reset-password', handler: resetPassword });
app.http('deactivateUser', { methods: ['POST'], authLevel: 'anonymous', route: 'users/{id}/deactivate', handler: deactivateUser });
app.http('reactivateUser', { methods: ['POST'], authLevel: 'anonymous', route: 'users/{id}/reactivate', handler: reactivateUser });
