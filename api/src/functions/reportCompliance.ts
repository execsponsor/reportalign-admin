/**
 * Report Compliance Azure Functions
 * Cross-org report submission rates and compliance metrics
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateSuperAdmin } from '../middleware/auth.js';
import { getPool } from '../utils/database.js';

async function getReportCompliance(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  try {
    const pool = getPool();

    // Use workflow_state for status filtering (the actual workflow column)
    const [totals, byOrg, monthlyVolume, cycleTime, stale] = await Promise.all([
      pool.query(`SELECT COUNT(*) as total_reports,
        COUNT(*) FILTER (WHERE workflow_state = 'approved') as approved,
        COUNT(*) FILTER (WHERE workflow_state = 'submitted') as submitted,
        COUNT(*) FILTER (WHERE workflow_state = 'draft') as draft,
        COUNT(*) FILTER (WHERE workflow_state IN ('rejected', 'changes_requested')) as rejected,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as last_30d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as last_7d
        FROM reports WHERE deleted_at IS NULL`),
      pool.query(`SELECT o.name as org_name, o.subdomain,
        COUNT(r.id) as total_reports,
        COUNT(r.id) FILTER (WHERE r.workflow_state = 'approved') as approved,
        COUNT(r.id) FILTER (WHERE r.workflow_state = 'draft') as draft,
        COUNT(r.id) FILTER (WHERE r.created_at >= NOW() - INTERVAL '30 days') as last_30d
        FROM organizations o
        LEFT JOIN programmes p ON p.organization_id = o.id AND p.deleted_at IS NULL
        LEFT JOIN reports r ON r.programme_id = p.id AND r.deleted_at IS NULL
        WHERE o.is_active = true
        GROUP BY o.id, o.name, o.subdomain
        HAVING COUNT(r.id) > 0
        ORDER BY last_30d DESC LIMIT 15`),
      pool.query(`SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as total,
        COUNT(*) FILTER (WHERE workflow_state = 'approved') as approved
        FROM reports WHERE created_at >= NOW() - INTERVAL '6 months' AND deleted_at IS NULL
        GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY month`),
      pool.query(`SELECT AVG(EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 3600) as avg_hours_to_approval,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 3600) as median_hours
        FROM reports WHERE workflow_state = 'approved' AND submitted_at IS NOT NULL AND approved_at IS NOT NULL AND approved_at >= NOW() - INTERVAL '30 days'`),
      pool.query(`SELECT p.id, p.name as programme_name, o.name as org_name, o.subdomain, MAX(r.created_at) as last_report_date
        FROM programmes p JOIN organizations o ON p.organization_id = o.id
        LEFT JOIN reports r ON r.programme_id = p.id AND r.deleted_at IS NULL
        WHERE p.deleted_at IS NULL AND o.is_active = true
        GROUP BY p.id, p.name, o.name, o.subdomain
        HAVING MAX(r.created_at) IS NULL OR MAX(r.created_at) < NOW() - INTERVAL '60 days'
        ORDER BY last_report_date ASC NULLS FIRST LIMIT 20`),
    ]);

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
  } catch (err) {
    context.error('getReportCompliance error:', err instanceof Error ? err.message : String(err));
    return { status: 500, jsonBody: { success: false, error: err instanceof Error ? err.message : 'Internal error' } };
  }
}

app.http('getReportCompliance', { methods: ['GET'], authLevel: 'anonymous', route: 'report-compliance', handler: getReportCompliance });
