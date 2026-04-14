/**
 * Report Compliance Azure Functions
 * Cross-org report submission rates and compliance metrics
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateSuperAdmin } from '../middleware/auth.js';
import { getPool } from '../utils/database.js';

// ============================================================================
// GET /api/report-compliance — Platform-wide reporting compliance
// ============================================================================

async function getReportCompliance(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const pool = getPool();

  // Overall report stats
  const totals = await pool.query(
    `SELECT
       COUNT(*) as total_reports,
       COUNT(*) FILTER (WHERE status = 'approved') as approved,
       COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
       COUNT(*) FILTER (WHERE status = 'draft') as draft,
       COUNT(*) FILTER (WHERE status = 'rejected' OR status = 'changes_requested') as rejected,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as last_30d,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as last_7d
     FROM reports`
  );

  // Reports by organisation (top 15 by activity)
  const byOrg = await pool.query(
    `SELECT o.name as org_name, o.subdomain,
            COUNT(r.id) as total_reports,
            COUNT(r.id) FILTER (WHERE r.status = 'approved') as approved,
            COUNT(r.id) FILTER (WHERE r.status = 'draft') as draft,
            COUNT(r.id) FILTER (WHERE r.created_at >= NOW() - INTERVAL '30 days') as last_30d
     FROM organizations o
     LEFT JOIN programmes p ON p.organization_id = o.id AND p.deleted_at IS NULL
     LEFT JOIN reports r ON r.programme_id = p.id
     WHERE o.is_active = true
     GROUP BY o.id, o.name, o.subdomain
     HAVING COUNT(r.id) > 0
     ORDER BY last_30d DESC
     LIMIT 15`
  );

  // Monthly report volume (last 6 months)
  const monthlyVolume = await pool.query(
    `SELECT TO_CHAR(created_at, 'YYYY-MM') as month,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'approved') as approved
     FROM reports
     WHERE created_at >= NOW() - INTERVAL '6 months'
     GROUP BY TO_CHAR(created_at, 'YYYY-MM')
     ORDER BY month`
  );

  // Average approval cycle time (submitted to approved, last 30 days)
  const cycleTime = await pool.query(
    `SELECT
       AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as avg_hours_to_approval,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as median_hours
     FROM reports
     WHERE status = 'approved' AND created_at >= NOW() - INTERVAL '30 days'`
  );

  // Programmes with no reports in last 60 days
  const stale = await pool.query(
    `SELECT p.id, p.name as programme_name, o.name as org_name, o.subdomain,
            MAX(r.created_at) as last_report_date
     FROM programmes p
     JOIN organizations o ON p.organization_id = o.id
     LEFT JOIN reports r ON r.programme_id = p.id
     WHERE p.deleted_at IS NULL AND o.is_active = true
     GROUP BY p.id, p.name, o.name, o.subdomain
     HAVING MAX(r.created_at) IS NULL OR MAX(r.created_at) < NOW() - INTERVAL '60 days'
     ORDER BY last_report_date ASC NULLS FIRST
     LIMIT 20`
  );

  return {
    status: 200,
    jsonBody: {
      success: true,
      data: {
        totals: totals.rows[0],
        by_org: byOrg.rows,
        monthly_volume: monthlyVolume.rows,
        cycle_time: {
          avg_hours: cycleTime.rows[0]?.avg_hours_to_approval ? Math.round(parseFloat(cycleTime.rows[0].avg_hours_to_approval)) : null,
          median_hours: cycleTime.rows[0]?.median_hours ? Math.round(parseFloat(cycleTime.rows[0].median_hours)) : null,
        },
        stale_programmes: stale.rows,
      },
    },
  };
}

app.http('getReportCompliance', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'report-compliance',
  handler: getReportCompliance,
});
