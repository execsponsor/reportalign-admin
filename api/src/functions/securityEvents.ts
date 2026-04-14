/**
 * Security Events Azure Functions
 * Platform-wide security event monitoring
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateSuperAdmin } from '../middleware/auth.js';
import { getPool } from '../utils/database.js';

// ============================================================================
// GET /api/security-events — List security events with filters
// ============================================================================

async function listSecurityEvents(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const pool = getPool();
  const page = parseInt(req.query.get('page') || '1');
  const limit = Math.min(parseInt(req.query.get('limit') || '50'), 100);
  const offset = (page - 1) * limit;
  const severity = req.query.get('severity');
  const eventType = req.query.get('eventType');
  const email = req.query.get('email');
  const ip = req.query.get('ip');
  const fromDate = req.query.get('fromDate');
  const toDate = req.query.get('toDate');

  let whereClause = 'WHERE 1=1';
  const params: unknown[] = [];
  let paramIdx = 1;

  if (severity) {
    whereClause += ` AND se.severity = $${paramIdx++}`;
    params.push(severity);
  }
  if (eventType) {
    whereClause += ` AND se.event_type = $${paramIdx++}`;
    params.push(eventType);
  }
  if (email) {
    whereClause += ` AND se.email ILIKE $${paramIdx++}`;
    params.push(`%${email}%`);
  }
  if (ip) {
    whereClause += ` AND se.ip_address = $${paramIdx++}`;
    params.push(ip);
  }
  if (fromDate) {
    whereClause += ` AND se.created_at >= $${paramIdx++}`;
    params.push(fromDate);
  }
  if (toDate) {
    whereClause += ` AND se.created_at <= $${paramIdx++}::date + INTERVAL '1 day'`;
    params.push(toDate);
  }

  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM security_events se ${whereClause}`,
    params
  );

  const eventsResult = await pool.query(
    `SELECT se.id, se.event_type, se.severity, se.email, se.user_id,
            se.ip_address, se.user_agent, se.reason, se.details, se.created_at
     FROM security_events se
     ${whereClause}
     ORDER BY se.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
    [...params, limit, offset]
  );

  return {
    status: 200,
    jsonBody: {
      success: true,
      data: {
        events: eventsResult.rows,
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
        },
      },
    },
  };
}

// ============================================================================
// GET /api/security-events/summary — Aggregated security stats
// ============================================================================

async function getSecuritySummary(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const pool = getPool();

  // Last 24h failed logins
  const failed24h = await pool.query(
    `SELECT COUNT(*) as count FROM security_events
     WHERE event_type = 'auth.failed_login' AND created_at >= NOW() - INTERVAL '24 hours'`
  );

  // Last 24h account lockouts
  const lockouts24h = await pool.query(
    `SELECT COUNT(*) as count FROM security_events
     WHERE event_type = 'auth.account_locked' AND created_at >= NOW() - INTERVAL '24 hours'`
  );

  // Last 7 days by severity
  const bySeverity7d = await pool.query(
    `SELECT severity, COUNT(*) as count FROM security_events
     WHERE created_at >= NOW() - INTERVAL '7 days'
     GROUP BY severity ORDER BY count DESC`
  );

  // Last 7 days by event type
  const byType7d = await pool.query(
    `SELECT event_type, COUNT(*) as count FROM security_events
     WHERE created_at >= NOW() - INTERVAL '7 days'
     GROUP BY event_type ORDER BY count DESC`
  );

  // Top offending IPs (last 24h)
  const topIps24h = await pool.query(
    `SELECT ip_address, COUNT(*) as count FROM security_events
     WHERE created_at >= NOW() - INTERVAL '24 hours' AND ip_address IS NOT NULL
     GROUP BY ip_address ORDER BY count DESC LIMIT 10`
  );

  // Top targeted emails (last 24h)
  const topEmails24h = await pool.query(
    `SELECT email, COUNT(*) as count FROM security_events
     WHERE created_at >= NOW() - INTERVAL '24 hours' AND email IS NOT NULL
     GROUP BY email ORDER BY count DESC LIMIT 10`
  );

  // Daily event counts (last 14 days)
  const dailyCounts = await pool.query(
    `SELECT DATE(created_at) as date, COUNT(*) as count FROM security_events
     WHERE created_at >= NOW() - INTERVAL '14 days'
     GROUP BY DATE(created_at) ORDER BY date`
  );

  return {
    status: 200,
    jsonBody: {
      success: true,
      data: {
        failed_logins_24h: parseInt(failed24h.rows[0].count),
        lockouts_24h: parseInt(lockouts24h.rows[0].count),
        by_severity_7d: bySeverity7d.rows,
        by_type_7d: byType7d.rows,
        top_ips_24h: topIps24h.rows,
        top_emails_24h: topEmails24h.rows,
        daily_counts_14d: dailyCounts.rows,
      },
    },
  };
}

// ============================================================================
// Register routes
// ============================================================================

app.http('listSecurityEvents', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'security-events',
  handler: listSecurityEvents,
});

app.http('getSecuritySummary', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'security-events/summary',
  handler: getSecuritySummary,
});
