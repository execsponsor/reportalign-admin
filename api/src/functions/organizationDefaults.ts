/**
 * Organization Defaults API
 * GET/PUT /api/organization-defaults — manage the default config applied when creating new organizations
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateSuperAdmin, logAuditAction } from '../middleware/auth';
import { checkRateLimit } from '../middleware/rateLimit';
import { getPool } from '../utils/database';
import { snakeToCamel } from '../utils/caseTransform';
import { readFileSync } from 'fs';
import { join } from 'path';

const CONFIG_KEY = 'organization_defaults';

// Load defaults from config file instead of hardcoding ~90 lines inline
const HARDCODED_DEFAULTS = JSON.parse(
  readFileSync(join(__dirname, '..', 'config', 'organization-defaults.json'), 'utf-8')
) as Record<string, unknown>;

// ============================================================================
// GET /api/organization-defaults — Retrieve current defaults
// ============================================================================

async function getOrganizationDefaults(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT config_value, updated_at, updated_by FROM platform_config WHERE config_key = $1',
      [CONFIG_KEY]
    );

    const defaults = result.rows.length > 0 ? result.rows[0].config_value : HARDCODED_DEFAULTS;
    const updatedAt = result.rows.length > 0 ? result.rows[0].updated_at : null;
    const updatedBy = result.rows.length > 0 ? result.rows[0].updated_by : null;

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          defaults,
          updatedAt,
          updatedBy,
          isFromDatabase: result.rows.length > 0,
        },
      },
    };
  } catch (err) {
    context.error('getOrganizationDefaults error:', err instanceof Error ? err.message : String(err));
    return { status: 500, jsonBody: { success: false, error: err instanceof Error ? err.message : 'Internal error' } };
  }
}

// ============================================================================
// PUT /api/organization-defaults — Update defaults
// ============================================================================

async function updateOrganizationDefaults(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const rateLimited = checkRateLimit(req);
  if (rateLimited) return rateLimited;

  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  try {
    const body = await req.json() as Record<string, unknown>;
    const newDefaults = body.defaults;

    if (!newDefaults || typeof newDefaults !== 'object') {
      return { status: 400, jsonBody: { success: false, error: 'Request body must contain a "defaults" object' } };
    }

    // Basic structural validation — ensure required top-level keys exist
    const required = ['organization_settings', 'portfolio_grouping', 'primary_brand_color', 'workflow_steps', 'workflow_transitions'];
    const missing = required.filter(key => !(key in (newDefaults as Record<string, unknown>)));
    if (missing.length > 0) {
      return { status: 400, jsonBody: { success: false, error: `Missing required keys: ${missing.join(', ')}` } };
    }

    const pool = getPool();

    // Fetch current value for audit log
    const current = await pool.query(
      'SELECT config_value FROM platform_config WHERE config_key = $1',
      [CONFIG_KEY]
    );
    const previousValue = current.rows.length > 0 ? current.rows[0].config_value : null;

    // Upsert
    await pool.query(
      `INSERT INTO platform_config (config_key, config_value, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), $3)
       ON CONFLICT (config_key) DO UPDATE SET
         config_value = $2::jsonb,
         updated_at = NOW(),
         updated_by = $3`,
      [CONFIG_KEY, JSON.stringify(newDefaults), auth.superAdminId]
    );

    await logAuditAction(
      auth.superAdminId!,
      'UPDATE_ORGANIZATION_DEFAULTS',
      'platform_config',
      null,
      previousValue,
      newDefaults as Record<string, unknown>
    );

    return {
      status: 200,
      jsonBody: { success: true, message: 'Organization defaults updated successfully' },
    };
  } catch (err) {
    context.error('updateOrganizationDefaults error:', err instanceof Error ? err.message : String(err));
    return { status: 500, jsonBody: { success: false, error: err instanceof Error ? err.message : 'Internal error' } };
  }
}

// ============================================================================
// Register routes
// ============================================================================

app.http('getOrganizationDefaults', { methods: ['GET'], authLevel: 'function', route: 'organization-defaults', handler: getOrganizationDefaults });
app.http('updateOrganizationDefaults', { methods: ['PUT'], authLevel: 'function', route: 'organization-defaults', handler: updateOrganizationDefaults });
