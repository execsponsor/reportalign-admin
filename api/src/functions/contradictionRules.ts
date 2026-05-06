/**
 * Contradiction Rules Azure Functions
 * Super admin management of Predictive Assurance rule library
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateSuperAdmin, logAuditAction } from '../middleware/auth.js';
import { checkRateLimit } from '../middleware/rateLimit.js';
import { getPool } from '../utils/database.js';
import { snakeToCamel } from '../utils/caseTransform.js';

/** Shape of a contradiction rule row joined with its conditions */
interface ContradictionRuleRow {
  id: string;
  rule_code: string;
  name: string;
  archetype: string;
  pack: string;
  rule_type: string;
  presentation_description: string | null;
  pm_challenge_text: string | null;
  exec_challenge_text: string | null;
  outcome_tags: string[] | null;
  default_severity: string;
  escalate_after_cycles: number | null;
  escalate_to: string | null;
  is_active: boolean;
  is_mvp: boolean;
  created_at: string;
  updated_at: string;
  override_count: number;
  [key: string]: unknown; // rule_conditions columns
}

/** Request body for updating a contradiction rule */
interface UpdateContradictionRuleBody {
  pm_challenge_text?: string;
  exec_challenge_text?: string;
  presentation_description?: string;
  default_severity?: string;
  escalate_after_cycles?: number;
  escalate_to?: string;
  is_active?: boolean;
  is_mvp?: boolean;
  tunable_threshold_current?: number;
  [key: string]: unknown;
}

// --- List all system default rules with conditions ---

async function listContradictionRules(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) { return { status: 401, jsonBody: { error: auth.error } }; }

  try {
    const pool = getPool();

    const rulesResult = await pool.query(
      `SELECT cr.id, cr.rule_code, cr.name, cr.archetype, cr.pack, cr.rule_type,
              cr.presentation_description, cr.pm_challenge_text, cr.exec_challenge_text,
              cr.outcome_tags, cr.default_severity, cr.escalate_after_cycles, cr.escalate_to,
              cr.is_active, cr.is_mvp, cr.created_at, cr.updated_at,
              rc.indicator_a, rc.indicator_a_condition, rc.indicator_a_rag_values,
              rc.indicator_b, rc.indicator_b_condition, rc.indicator_b_rag_values,
              rc.temporal_indicator, rc.was_status, rc.then_changed_to, rc.for_consecutive_periods,
              rc.data_field, rc.stability_threshold_periods, rc.absence_weeks,
              rc.slipped_percentage_gte, rc.schedule_rag_not_in,
              rc.budget_consumed_pct_threshold, rc.consecutive_milestones_slipped,
              rc.milestones_missed_pct_threshold,
              rc.quality_dimension, rc.quality_score_below, rc.quality_section,
              rc.prediction_expected, rc.prediction_actual,
              rc.portfolio_criterion, rc.min_programme_count, rc.threshold_pct,
              rc.tunable_threshold_name, rc.tunable_threshold_label,
              rc.tunable_threshold_default, rc.tunable_threshold_min,
              rc.tunable_threshold_max, rc.tunable_threshold_current,
              rc.n_periods
       FROM contradiction_rules cr
       LEFT JOIN rule_conditions rc ON rc.rule_id = cr.id
       WHERE cr.organization_id IS NULL AND cr.is_system_default = true
       ORDER BY cr.pack, cr.rule_code`
    );

    // Count tenant overrides per rule
    const overridesResult = await pool.query(
      `SELECT rule_id, COUNT(*)::int AS override_count
       FROM tenant_rule_overrides
       GROUP BY rule_id`
    );
    const overrideCounts: Record<string, number> = {};
    for (const row of overridesResult.rows) {
      overrideCounts[row.rule_id] = row.override_count;
    }

    const rules: ContradictionRuleRow[] = rulesResult.rows.map((r: ContradictionRuleRow) => ({
      ...r,
      override_count: overrideCounts[r.id] || 0,
    }));

    // Summary stats
    const stats = {
      total: rules.length,
      active: rules.filter((r) => r.is_active).length,
      mvp: rules.filter((r) => r.is_mvp).length,
      by_pack: {
        waterfall: rules.filter((r) => r.pack === 'waterfall').length,
        agile: rules.filter((r) => r.pack === 'agile').length,
        hybrid: rules.filter((r) => r.pack === 'hybrid').length,
        pmo: rules.filter((r) => r.pack === 'pmo').length,
      },
      by_archetype: {} as Record<string, number>,
    };
    for (const r of rules) {
      stats.by_archetype[r.archetype] = (stats.by_archetype[r.archetype] || 0) + 1;
    }

    return { status: 200, jsonBody: { success: true, data: { rules: snakeToCamel(rules), stats: snakeToCamel(stats) } } };
  } catch (err) {
    context.error('listContradictionRules error:', err instanceof Error ? err.message : String(err));
    return { status: 500, jsonBody: { success: false, error: err instanceof Error ? err.message : 'Internal error' } };
  }
}

// --- Update a system default rule ---

async function updateContradictionRule(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const rateLimited = checkRateLimit(req);
  if (rateLimited) return rateLimited;

  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) { return { status: 401, jsonBody: { error: auth.error } }; }

  try {
    const pool = getPool();
    const ruleId = req.params.ruleId;
    const body = await req.json() as UpdateContradictionRuleBody;

    // Only allow updating specific fields
    const allowedFields = [
      'pm_challenge_text', 'exec_challenge_text', 'presentation_description',
      'default_severity', 'escalate_after_cycles', 'escalate_to',
      'is_active', 'is_mvp',
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        setClauses.push(`${field} = $${paramIdx++}`);
        values.push(body[field]);
      }
    }

    if (setClauses.length === 0) {
      return { status: 400, jsonBody: { success: false, error: 'No valid fields to update' } };
    }

    setClauses.push(`updated_at = now()`);
    values.push(ruleId);

    await pool.query(
      `UPDATE contradiction_rules SET ${setClauses.join(', ')} WHERE id = $${paramIdx} AND is_system_default = true`,
      values
    );

    // Update tunable threshold if provided
    if (body.tunable_threshold_current !== undefined) {
      await pool.query(
        `UPDATE rule_conditions SET tunable_threshold_current = $1 WHERE rule_id = $2`,
        [body.tunable_threshold_current, ruleId]
      );
    }

    await logAuditAction(auth.superAdminId!, 'UPDATE_CONTRADICTION_RULE', 'contradiction_rule', ruleId, null, {
      rule_id: ruleId,
      fields_updated: Object.keys(body).filter(k => allowedFields.includes(k) || k === 'tunable_threshold_current'),
    });

    return { status: 200, jsonBody: { success: true, message: 'Rule updated' } };
  } catch (err) {
    context.error('updateContradictionRule error:', err instanceof Error ? err.message : String(err));
    return { status: 500, jsonBody: { success: false, error: err instanceof Error ? err.message : 'Internal error' } };
  }
}

// --- Register Azure Functions ---

app.http('listContradictionRules', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'contradiction-rules',
  handler: listContradictionRules,
});

app.http('updateContradictionRule', {
  methods: ['PATCH'],
  authLevel: 'function',
  route: 'contradiction-rules/{ruleId}',
  handler: updateContradictionRule,
});
