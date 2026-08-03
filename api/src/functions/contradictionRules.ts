/**
 * Signal Detection Rules — Super Admin Master Library Management
 *
 * Manages the master rule library (sentinel org 00000000-0000-0000-0000-000000000001).
 * When a super-admin creates/updates/disables a master rule, new orgs get the updated version.
 * Also provides cross-org oversight: which orgs have customised or disabled rules.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { logAuditAction, withSuperAdmin, AuthenticatedSuperAdmin } from '../middleware/auth';
import { checkRateLimit } from '../middleware/rateLimit';
import { getPool } from '../utils/database';


const MASTER_ORG_ID = '00000000-0000-0000-0000-000000000001';

// --- List master rules ---
async function listMasterRules(req: HttpRequest, context: InvocationContext, auth: AuthenticatedSuperAdmin): Promise<HttpResponseInit> {
  const rateLimitResult = checkRateLimit(req);
  if (rateLimitResult) { return rateLimitResult; }

  try {
    const pool = getPool();

    const rulesResult = await pool.query(
      `SELECT id, rule_code, name, contradiction_type, indicators, trigger_logic,
              why_it_matters, surfaced_text, outcome_relevance, enabled,
              is_system_default, created_at, updated_at
       FROM contradiction_rules
       WHERE organization_id = $1
       ORDER BY rule_code`,
      [MASTER_ORG_ID]
    );

    // Get per-org adoption stats
    const statsResult = await pool.query(
      `SELECT rule_code,
              COUNT(DISTINCT organization_id) FILTER (WHERE organization_id != $1) as org_count,
              COUNT(DISTINCT organization_id) FILTER (WHERE enabled = false AND organization_id != $1) as disabled_count
       FROM contradiction_rules
       WHERE is_system_default = true
       GROUP BY rule_code`,
      [MASTER_ORG_ID]
    );

    const statsMap = new Map<string, { orgCount: number; disabledCount: number }>();
    for (const row of statsResult.rows) {
      statsMap.set(row.rule_code, { orgCount: parseInt(row.org_count), disabledCount: parseInt(row.disabled_count) });
    }

    const rules = rulesResult.rows.map((r: Record<string, unknown>) => {
      const stats = statsMap.get(r.rule_code as string);
      return { ...(r as Record<string, unknown>), orgCount: stats?.orgCount || 0, disabledByOrgs: stats?.disabledCount || 0 };
    });

    return { status: 200, jsonBody: { success: true, data: rules } };
  } catch (error) {
    context.error('Error listing master rules:', error);
    return { status: 500, jsonBody: { error: 'Failed to list rules' } };
  }
}

// --- Create a new master rule ---
async function createMasterRule(req: HttpRequest, context: InvocationContext, auth: AuthenticatedSuperAdmin): Promise<HttpResponseInit> {
  try {
    const pool = getPool();
    const body = await req.json() as Record<string, unknown>;

    // Validate required fields
    if (!body.ruleCode || !body.name || !body.contradictionType || !body.triggerLogic || !body.surfacedText) {
      return { status: 400, jsonBody: { error: 'Missing required fields: ruleCode, name, contradictionType, triggerLogic, surfacedText' } };
    }

    const result = await pool.query(
      `INSERT INTO contradiction_rules (
        organization_id, rule_code, name, contradiction_type, indicators,
        trigger_logic, why_it_matters, surfaced_text, outcome_relevance,
        enabled, is_system_default, pm_challenge_text, exec_challenge_text,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $8, $8, NOW(), NOW())
      RETURNING *`,
      [
        MASTER_ORG_ID, body.ruleCode, body.name, body.contradictionType,
        body.indicators || [], body.triggerLogic, body.whyItMatters || null,
        body.surfacedText, body.outcomeRelevance || [],
        body.enabled !== false,
      ]
    );

    await logAuditAction(auth.superAdminId!, 'master_rule.created', 'contradiction_rule', result.rows[0].id, null, result.rows[0] as Record<string, unknown>);

    return { status: 201, jsonBody: { success: true, data: result.rows[0] } };
  } catch (error: unknown) {
    const msg = (error as Error).message || '';
    if (msg.includes('uq_contradiction_rules_org_code')) {
      return { status: 409, jsonBody: { error: `Rule code '${(await req.json() as Record<string, unknown>).ruleCode}' already exists` } };
    }
    context.error('Error creating master rule:', error);
    return { status: 500, jsonBody: { error: 'Failed to create rule' } };
  }
}

// --- Update a master rule ---
async function updateMasterRule(req: HttpRequest, context: InvocationContext, auth: AuthenticatedSuperAdmin): Promise<HttpResponseInit> {
  try {
    const pool = getPool();
    const ruleId = req.params.ruleId;
    const body = await req.json() as Record<string, unknown>;

    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [ruleId, MASTER_ORG_ID];
    let idx = 3;

    if (body.name !== undefined) { sets.push(`name = $${idx++}`); params.push(body.name); }
    if (body.triggerLogic !== undefined) { sets.push(`trigger_logic = $${idx++}`); params.push(body.triggerLogic); }
    if (body.whyItMatters !== undefined) { sets.push(`why_it_matters = $${idx++}`); params.push(body.whyItMatters); }
    if (body.surfacedText !== undefined) {
      sets.push(`surfaced_text = $${idx}`, `pm_challenge_text = $${idx}`, `exec_challenge_text = $${idx++}`);
      params.push(body.surfacedText);
    }
    if (body.indicators !== undefined) { sets.push(`indicators = $${idx++}`); params.push(body.indicators); }
    if (body.outcomeRelevance !== undefined) { sets.push(`outcome_relevance = $${idx++}`); params.push(body.outcomeRelevance); }
    if (body.enabled !== undefined) { sets.push(`enabled = $${idx++}`); params.push(body.enabled); }

    const result = await pool.query(
      `UPDATE contradiction_rules SET ${sets.join(', ')} WHERE id = $1 AND organization_id = $2 RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return { status: 404, jsonBody: { error: 'Master rule not found' } };
    }

    await logAuditAction(auth.superAdminId!, 'master_rule.updated', 'contradiction_rule', ruleId!, null, result.rows[0] as Record<string, unknown>);

    return { status: 200, jsonBody: { success: true, data: result.rows[0] } };
  } catch (error) {
    context.error('Error updating master rule:', error);
    return { status: 500, jsonBody: { error: 'Failed to update rule' } };
  }
}

// --- Delete a master rule ---
async function deleteMasterRule(req: HttpRequest, context: InvocationContext, auth: AuthenticatedSuperAdmin): Promise<HttpResponseInit> {
  try {
    const pool = getPool();
    const ruleId = req.params.ruleId;

    const result = await pool.query(
      `DELETE FROM contradiction_rules WHERE id = $1 AND organization_id = $2 RETURNING rule_code`,
      [ruleId, MASTER_ORG_ID]
    );

    if (result.rows.length === 0) {
      return { status: 404, jsonBody: { error: 'Master rule not found' } };
    }

    await logAuditAction(auth.superAdminId!, 'master_rule.deleted', 'contradiction_rule', ruleId!, { ruleCode: result.rows[0].rule_code }, null);

    return { status: 200, jsonBody: { success: true, data: { deleted: true, ruleCode: result.rows[0].rule_code } } };
  } catch (error) {
    context.error('Error deleting master rule:', error);
    return { status: 500, jsonBody: { error: 'Failed to delete rule' } };
  }
}

// --- Push a master rule update to all orgs ---
async function pushRuleToOrgs(req: HttpRequest, context: InvocationContext, auth: AuthenticatedSuperAdmin): Promise<HttpResponseInit> {
  try {
    const pool = getPool();
    const ruleId = req.params.ruleId;

    // Get the master rule
    const masterRule = await pool.query(
      `SELECT * FROM contradiction_rules WHERE id = $1 AND organization_id = $2`,
      [ruleId, MASTER_ORG_ID]
    );

    if (masterRule.rows.length === 0) {
      return { status: 404, jsonBody: { error: 'Master rule not found' } };
    }

    const rule = masterRule.rows[0];

    // Update all org copies of this rule (only system-default ones — not custom overrides)
    const result = await pool.query(
      `UPDATE contradiction_rules
       SET name = $2, contradiction_type = $3, indicators = $4,
           trigger_logic = $5, why_it_matters = $6, surfaced_text = $7,
           pm_challenge_text = $7, exec_challenge_text = $7,
           outcome_relevance = $8, updated_at = NOW()
       WHERE rule_code = $1
         AND organization_id != $9
         AND is_system_default = true`,
      [
        rule.rule_code, rule.name, rule.contradiction_type, rule.indicators,
        rule.trigger_logic, rule.why_it_matters, rule.surfaced_text,
        rule.outcome_relevance, MASTER_ORG_ID,
      ]
    );

    await logAuditAction(auth.superAdminId!, 'master_rule.pushed', 'contradiction_rule', ruleId!, null, { ruleCode: rule.rule_code, orgsUpdated: result.rowCount });

    return {
      status: 200,
      jsonBody: { success: true, data: { ruleCode: rule.rule_code, orgsUpdated: result.rowCount } },
    };
  } catch (error) {
    context.error('Error pushing rule to orgs:', error);
    return { status: 500, jsonBody: { error: 'Failed to push rule' } };
  }
}

// --- Stats ---
async function getRuleStats(req: HttpRequest, context: InvocationContext, auth: AuthenticatedSuperAdmin): Promise<HttpResponseInit> {
  try {
    const pool = getPool();
    const stats = await pool.query(
      `SELECT contradiction_type, COUNT(DISTINCT rule_code) as rule_count
       FROM contradiction_rules WHERE organization_id = $1
       GROUP BY contradiction_type ORDER BY contradiction_type`,
      [MASTER_ORG_ID]
    );
    const totalOrgs = await pool.query(`SELECT COUNT(*) as count FROM organizations WHERE id != $1`, [MASTER_ORG_ID]);

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          totalOrganizations: parseInt(totalOrgs.rows[0].count),
          byType: stats.rows.map((r: Record<string, unknown>) => r),
        },
      },
    };
  } catch (error) {
    context.error('Error getting rule stats:', error);
    return { status: 500, jsonBody: { error: 'Failed to get stats' } };
  }
}

// --- Register Azure Functions ---

app.http('listMasterRules', { methods: ['GET'], authLevel: 'anonymous', route: 'signal-detection-rules', handler: withSuperAdmin(listMasterRules) });
app.http('createMasterRule', { methods: ['POST'], authLevel: 'anonymous', route: 'signal-detection-rules', handler: withSuperAdmin(createMasterRule) });
app.http('updateMasterRule', { methods: ['PATCH'], authLevel: 'anonymous', route: 'signal-detection-rules/{ruleId}', handler: withSuperAdmin(updateMasterRule) });
app.http('deleteMasterRule', { methods: ['DELETE'], authLevel: 'anonymous', route: 'signal-detection-rules/{ruleId}', handler: withSuperAdmin(deleteMasterRule) });
app.http('pushRuleToOrgs', { methods: ['POST'], authLevel: 'anonymous', route: 'signal-detection-rules/{ruleId}/push', handler: withSuperAdmin(pushRuleToOrgs) });
app.http('getRuleStats', { methods: ['GET'], authLevel: 'anonymous', route: 'signal-detection-rules/stats', handler: withSuperAdmin(getRuleStats) });
