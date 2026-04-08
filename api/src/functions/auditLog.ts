/**
 * Audit Log Azure Function
 * GET /api/audit-log
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateSuperAdmin } from '../middleware/auth.js';
import { getPool } from '../utils/database.js';
import { auditLogFilterSchema } from '../utils/validation.js';

async function getAuditLog(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const filters = auditLogFilterSchema.parse(Object.fromEntries(req.query));
  const pool = getPool();
  const offset = (filters.page - 1) * filters.limit;

  let whereClause = 'WHERE 1=1';
  const params: unknown[] = [];
  let paramIdx = 1;

  if (filters.adminEmail) {
    whereClause += ` AND u.email ILIKE $${paramIdx++}`;
    params.push(`%${filters.adminEmail}%`);
  }
  if (filters.organizationId) {
    whereClause += ` AND sal.target_id = $${paramIdx++}`;
    params.push(filters.organizationId);
  }
  if (filters.actionType) {
    whereClause += ` AND sal.action_type = $${paramIdx++}`;
    params.push(filters.actionType);
  }
  if (filters.fromDate) {
    whereClause += ` AND sal.created_at >= $${paramIdx++}`;
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    whereClause += ` AND sal.created_at <= $${paramIdx++}::date + INTERVAL '1 day'`;
    params.push(filters.toDate);
  }

  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM super_admin_audit_log sal
     JOIN super_administrators sa ON sal.super_admin_id = sa.id
     JOIN users u ON sa.user_id = u.id
     ${whereClause}`,
    params
  );

  const logResult = await pool.query(
    `SELECT sal.id, sal.action_type, sal.target_type, sal.target_id,
            sal.before_value, sal.after_value, sal.reason,
            sal.ip_address, sal.session_id, sal.created_at,
            u.email as admin_email, u.first_name as admin_first_name, u.last_name as admin_last_name
     FROM super_admin_audit_log sal
     JOIN super_administrators sa ON sal.super_admin_id = sa.id
     JOIN users u ON sa.user_id = u.id
     ${whereClause}
     ORDER BY sal.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
    [...params, filters.limit, offset]
  );

  return {
    status: 200,
    jsonBody: {
      success: true,
      data: {
        entries: logResult.rows,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(parseInt(countResult.rows[0].total) / filters.limit),
        },
      },
    },
  };
}

app.http('getAuditLog', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'audit-log',
  handler: getAuditLog,
});
