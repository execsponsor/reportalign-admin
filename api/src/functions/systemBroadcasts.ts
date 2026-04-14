/**
 * System Broadcasts & Maintenance Mode Azure Functions
 * Create, manage, and monitor platform announcements and maintenance windows
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateSuperAdmin, logAuditAction } from '../middleware/auth.js';
import { getPool } from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// GET /api/broadcasts — List all broadcasts
// ============================================================================

async function listBroadcasts(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const pool = getPool();
  const status = req.query.get('status'); // active, scheduled, expired

  let whereClause = 'WHERE 1=1';
  const params: unknown[] = [];
  let paramIdx = 1;

  if (status === 'active') {
    whereClause += ` AND sb.is_active = true AND (sb.ends_at IS NULL OR sb.ends_at > NOW()) AND (sb.starts_at IS NULL OR sb.starts_at <= NOW())`;
  } else if (status === 'scheduled') {
    whereClause += ` AND sb.is_active = true AND sb.starts_at > NOW()`;
  } else if (status === 'expired') {
    whereClause += ` AND (sb.is_active = false OR (sb.ends_at IS NOT NULL AND sb.ends_at <= NOW()))`;
  }

  const result = await pool.query(
    `SELECT sb.id, sb.title, sb.message, sb.link_url, sb.link_text,
            sb.broadcast_type, sb.target_organization_ids, sb.starts_at, sb.ends_at,
            sb.is_active, sb.show_on_auth_pages, sb.show_on_app,
            sb.total_impressions, sb.total_clicks, sb.created_by, sb.created_at, sb.updated_at,
            u.email as created_by_email
     FROM system_broadcasts sb
     LEFT JOIN users u ON sb.created_by = u.id
     ${whereClause}
     ORDER BY sb.created_at DESC
     LIMIT 50`,
    params
  );

  return {
    status: 200,
    jsonBody: { success: true, data: { broadcasts: result.rows } },
  };
}

// ============================================================================
// POST /api/broadcasts — Create a broadcast
// ============================================================================

async function createBroadcast(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const body = (await req.json()) as Record<string, unknown>;
  const pool = getPool();

  const validTypes = ['info', 'warning', 'critical'];
  if (!body.title || !body.message || !validTypes.includes(body.broadcast_type as string)) {
    return { status: 400, jsonBody: { success: false, error: 'title, message, and valid broadcast_type required' } };
  }

  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO system_broadcasts (id, title, message, link_url, link_text, broadcast_type,
      target_organization_ids, starts_at, ends_at, is_active, show_on_auth_pages, show_on_app, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      id, body.title, body.message, body.link_url || null, body.link_text || null,
      body.broadcast_type, body.target_organization_ids || null,
      body.starts_at || null, body.ends_at || null,
      body.is_active !== false, body.show_on_auth_pages || false, body.show_on_app !== false,
      auth.userId,
    ]
  );

  await logAuditAction(
    auth.superAdminId!, 'CREATE_BROADCAST', 'system_broadcast', id,
    null, { title: body.title, type: body.broadcast_type },
    `Created ${body.broadcast_type} broadcast: ${body.title}`
  );

  return { status: 201, jsonBody: { success: true, data: result.rows[0] } };
}

// ============================================================================
// PATCH /api/broadcasts/{id} — Update a broadcast
// ============================================================================

async function updateBroadcast(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const broadcastId = req.params.id;
  const body = (await req.json()) as Record<string, unknown>;
  const pool = getPool();

  const updates: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  const fields = ['title', 'message', 'link_url', 'link_text', 'broadcast_type',
    'starts_at', 'ends_at', 'is_active', 'show_on_auth_pages', 'show_on_app'];

  for (const field of fields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = $${paramIdx++}`);
      params.push(body[field]);
    }
  }

  if (updates.length === 0) {
    return { status: 400, jsonBody: { success: false, error: 'No fields to update' } };
  }

  updates.push(`updated_at = NOW()`);

  const result = await pool.query(
    `UPDATE system_broadcasts SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    [...params, broadcastId]
  );

  if (result.rows.length === 0) {
    return { status: 404, jsonBody: { success: false, error: 'Broadcast not found' } };
  }

  await logAuditAction(
    auth.superAdminId!, 'UPDATE_BROADCAST', 'system_broadcast', broadcastId,
    null, { is_active: body.is_active },
    `Updated broadcast: ${result.rows[0].title}`
  );

  return { status: 200, jsonBody: { success: true, data: result.rows[0] } };
}

// ============================================================================
// GET /api/maintenance-windows — List maintenance windows
// ============================================================================

async function listMaintenanceWindows(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const pool = getPool();

  const result = await pool.query(
    `SELECT mw.id, mw.title, mw.description, mw.reason,
            mw.scheduled_start, mw.scheduled_end, mw.actual_start, mw.actual_end,
            mw.status, mw.created_by, mw.created_at, mw.updated_at,
            u.email as created_by_email
     FROM maintenance_windows mw
     LEFT JOIN users u ON mw.created_by = u.id
     ORDER BY mw.scheduled_start DESC
     LIMIT 30`
  );

  return {
    status: 200,
    jsonBody: { success: true, data: { windows: result.rows } },
  };
}

// ============================================================================
// POST /api/maintenance-windows — Create maintenance window
// ============================================================================

async function createMaintenanceWindow(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const body = (await req.json()) as Record<string, unknown>;
  const pool = getPool();

  if (!body.title || !body.scheduled_start || !body.scheduled_end) {
    return { status: 400, jsonBody: { success: false, error: 'title, scheduled_start, scheduled_end required' } };
  }

  const validReasons = ['scheduled_maintenance', 'security_update', 'database_migration',
    'infrastructure_upgrade', 'emergency_maintenance', 'other'];
  const reason = validReasons.includes(body.reason as string) ? body.reason : 'scheduled_maintenance';

  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO maintenance_windows (id, title, description, reason, scheduled_start, scheduled_end, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7)
     RETURNING *`,
    [id, body.title, body.description || null, reason, body.scheduled_start, body.scheduled_end, auth.userId]
  );

  await logAuditAction(
    auth.superAdminId!, 'CREATE_MAINTENANCE_WINDOW', 'maintenance_window', id,
    null, { title: body.title, scheduled_start: body.scheduled_start },
    `Scheduled maintenance: ${body.title}`
  );

  return { status: 201, jsonBody: { success: true, data: result.rows[0] } };
}

// ============================================================================
// PATCH /api/maintenance-windows/{id} — Update maintenance window status
// ============================================================================

async function updateMaintenanceWindow(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const windowId = req.params.id;
  const body = (await req.json()) as Record<string, unknown>;
  const pool = getPool();

  const updates: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  const fields = ['title', 'description', 'reason', 'scheduled_start', 'scheduled_end',
    'actual_start', 'actual_end', 'status'];

  for (const field of fields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = $${paramIdx++}`);
      params.push(body[field]);
    }
  }

  if (updates.length === 0) {
    return { status: 400, jsonBody: { success: false, error: 'No fields to update' } };
  }

  updates.push(`updated_at = NOW()`);

  const result = await pool.query(
    `UPDATE maintenance_windows SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    [...params, windowId]
  );

  if (result.rows.length === 0) {
    return { status: 404, jsonBody: { success: false, error: 'Maintenance window not found' } };
  }

  await logAuditAction(
    auth.superAdminId!, 'UPDATE_MAINTENANCE_WINDOW', 'maintenance_window', windowId,
    null, { status: body.status },
    `Updated maintenance window: ${result.rows[0].title}`
  );

  return { status: 200, jsonBody: { success: true, data: result.rows[0] } };
}

// ============================================================================
// Register routes
// ============================================================================

app.http('listBroadcasts', { methods: ['GET'], authLevel: 'anonymous', route: 'broadcasts', handler: listBroadcasts });
app.http('createBroadcast', { methods: ['POST'], authLevel: 'anonymous', route: 'broadcasts', handler: createBroadcast });
app.http('updateBroadcast', { methods: ['PATCH'], authLevel: 'anonymous', route: 'broadcasts/{id}', handler: updateBroadcast });
app.http('listMaintenanceWindows', { methods: ['GET'], authLevel: 'anonymous', route: 'maintenance-windows', handler: listMaintenanceWindows });
app.http('createMaintenanceWindow', { methods: ['POST'], authLevel: 'anonymous', route: 'maintenance-windows', handler: createMaintenanceWindow });
app.http('updateMaintenanceWindow', { methods: ['PATCH'], authLevel: 'anonymous', route: 'maintenance-windows/{id}', handler: updateMaintenanceWindow });
