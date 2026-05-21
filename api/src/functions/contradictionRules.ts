/**
 * Signal Detection Rules — Super Admin Functions (READ-ONLY)
 *
 * Rule management has moved to the main platform (/Settings > Signal Detection Rules).
 * Each org now owns its own copy of the rule library.
 * This API provides read-only cross-org oversight for super admins.
 *
 * @deprecated For rule editing, use the per-org Settings page on the main platform.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateSuperAdmin } from '../middleware/auth.js';
import { checkRateLimit } from '../middleware/rateLimit.js';
import { getPool } from '../utils/database.js';
import { snakeToCamel } from '../utils/caseTransform.js';

// --- List system-default rules (read-only, cross-org summary) ---

async function listSignalDetectionRules(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) { return { status: 401, jsonBody: { error: auth.error } }; }

  const rateLimitResult = await checkRateLimit(req, context, 'contradiction-rules-list');
  if (rateLimitResult) { return rateLimitResult; }

  try {
    const pool = getPool();

    // Get distinct rules from any one org (they're all seeded from the same library)
    const rulesResult = await pool.query(
      `SELECT DISTINCT ON (cr.rule_code)
              cr.id, cr.rule_code, cr.name, cr.contradiction_type,
              cr.indicators, cr.trigger_logic, cr.why_it_matters, cr.surfaced_text,
              cr.outcome_relevance, cr.enabled, cr.is_system_default,
              cr.created_at, cr.updated_at
       FROM contradiction_rules cr
       WHERE cr.is_system_default = true
       ORDER BY cr.rule_code, cr.created_at`
    );

    // Get per-org customisation summary
    const customisationResult = await pool.query(
      `SELECT
         cr.rule_code,
         COUNT(DISTINCT cr.organization_id) as org_count,
         COUNT(DISTINCT cr.organization_id) FILTER (WHERE cr.enabled = false) as disabled_count,
         COUNT(DISTINCT cr.organization_id) FILTER (WHERE cr.is_system_default = false) as custom_count
       FROM contradiction_rules cr
       GROUP BY cr.rule_code
       ORDER BY cr.rule_code`
    );

    const customMap = new Map<string, { orgCount: number; disabledCount: number; customCount: number }>();
    for (const row of customisationResult.rows) {
      customMap.set(row.rule_code, {
        orgCount: parseInt(row.org_count),
        disabledCount: parseInt(row.disabled_count),
        customCount: parseInt(row.custom_count),
      });
    }

    const rules = rulesResult.rows.map((r: Record<string, unknown>) => {
      const custom = customMap.get(r.rule_code as string);
      return {
        ...snakeToCamel(r),
        orgCount: custom?.orgCount || 0,
        disabledByOrgs: custom?.disabledCount || 0,
        customVersions: custom?.customCount || 0,
      };
    });

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: rules,
        meta: {
          totalRules: rules.length,
          note: 'Read-only view. Rule management is per-org on the main platform Settings page.',
        },
      },
    };
  } catch (error) {
    context.error('Error listing signal detection rules:', error);
    return { status: 500, jsonBody: { error: 'Failed to list rules' } };
  }
}

// --- Get rule usage stats across all orgs ---

async function getRuleStats(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) { return { status: 401, jsonBody: { error: auth.error } }; }

  try {
    const pool = getPool();

    const stats = await pool.query(
      `SELECT
         cr.contradiction_type,
         COUNT(DISTINCT cr.rule_code) as rule_count,
         COUNT(DISTINCT cr.organization_id) as org_count
       FROM contradiction_rules cr
       WHERE cr.is_system_default = true
       GROUP BY cr.contradiction_type
       ORDER BY cr.contradiction_type`
    );

    const totalOrgs = await pool.query('SELECT COUNT(*) as count FROM organizations');

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          totalOrganizations: parseInt(totalOrgs.rows[0].count),
          byType: stats.rows.map((r: Record<string, unknown>) => snakeToCamel(r)),
        },
      },
    };
  } catch (error) {
    context.error('Error getting rule stats:', error);
    return { status: 500, jsonBody: { error: 'Failed to get rule stats' } };
  }
}

// --- Register Azure Functions ---

app.http('listSignalDetectionRules', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'signal-detection-rules',
  handler: listSignalDetectionRules,
});

app.http('getRuleStats', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'signal-detection-rules/stats',
  handler: getRuleStats,
});
