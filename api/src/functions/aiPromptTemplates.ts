/**
 * AI Prompt Templates Azure Functions
 * Super admin management of system-default AI prompt templates
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateSuperAdmin, logAuditAction } from '../middleware/auth.js';
import { getPool } from '../utils/database.js';

const VALID_TEMPLATE_KEYS = ['improve', 'expand', 'summarize', 'formalize', 'executive_summary', 'risk_analysis', 'status_narrative', 'recommendation', 'board_brief'];
const VALID_TONES = ['formal', 'conversational', 'technical', 'executive'];
const VALID_AUDIENCES = ['board', 'executives', 'stakeholders', 'team'];

async function listAIPromptTemplates(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  try {
    const pool = getPool();

    const templatesResult = await pool.query(
      `SELECT id, template_key, display_name, description, system_prompt, user_prompt_template, is_active, tone, target_audience, max_output_tokens, temperature, example_input, example_output, created_at, updated_at
       FROM ai_prompt_templates WHERE organization_id IS NULL AND is_default = true ORDER BY template_key`
    );

    const overridesResult = await pool.query(
      `SELECT template_key, COUNT(*) as override_count FROM ai_prompt_templates WHERE organization_id IS NOT NULL AND is_default = false GROUP BY template_key`
    );

    const overrideCounts: Record<string, number> = {};
    for (const row of overridesResult.rows) overrideCounts[row.template_key] = parseInt(row.override_count);

    const templates = templatesResult.rows.map((t) => ({ ...t, override_count: overrideCounts[t.template_key] || 0 }));

    return { status: 200, jsonBody: { success: true, data: { templates } } };
  } catch (err) {
    context.error('listAIPromptTemplates error:', err instanceof Error ? err.message : String(err));
    return { status: 500, jsonBody: { success: false, error: err instanceof Error ? err.message : 'Internal error' } };
  }
}

async function getAIPromptTemplate(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  try {
    const templateKey = req.params.templateKey;
    const pool = getPool();

    const templateResult = await pool.query(
      `SELECT id, template_key, display_name, description, system_prompt, user_prompt_template, is_active, tone, target_audience, max_output_tokens, temperature, example_input, example_output, created_at, updated_at
       FROM ai_prompt_templates WHERE organization_id IS NULL AND is_default = true AND template_key = $1`, [templateKey]
    );

    if (templateResult.rows.length === 0) return { status: 404, jsonBody: { success: false, error: 'Template not found' } };

    const overridesResult = await pool.query(
      `SELECT apt.id, apt.organization_id, o.name as organization_name, o.subdomain, apt.system_prompt, apt.tone, apt.target_audience, apt.temperature, apt.max_output_tokens, apt.updated_at
       FROM ai_prompt_templates apt JOIN organizations o ON apt.organization_id = o.id
       WHERE apt.template_key = $1 AND apt.organization_id IS NOT NULL AND apt.is_default = false ORDER BY o.name`, [templateKey]
    );

    return { status: 200, jsonBody: { success: true, data: { template: templateResult.rows[0], overrides: overridesResult.rows } } };
  } catch (err) {
    context.error('getAIPromptTemplate error:', err instanceof Error ? err.message : String(err));
    return { status: 500, jsonBody: { success: false, error: err instanceof Error ? err.message : 'Internal error' } };
  }
}

async function updateAIPromptTemplate(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  try {
    const templateKey = req.params.templateKey;
    if (!VALID_TEMPLATE_KEYS.includes(templateKey)) return { status: 400, jsonBody: { success: false, error: 'Invalid template key' } };

    const body = (await req.json()) as Record<string, unknown>;
    const pool = getPool();

    if (body.tone !== undefined && body.tone !== null && !VALID_TONES.includes(body.tone as string)) return { status: 400, jsonBody: { success: false, error: 'Invalid tone' } };
    if (body.target_audience !== undefined && body.target_audience !== null && !VALID_AUDIENCES.includes(body.target_audience as string)) return { status: 400, jsonBody: { success: false, error: 'Invalid target_audience' } };

    const existing = await pool.query(
      `SELECT id, system_prompt, tone, temperature FROM ai_prompt_templates WHERE organization_id IS NULL AND is_default = true AND template_key = $1`, [templateKey]
    );
    if (existing.rows.length === 0) return { status: 404, jsonBody: { success: false, error: 'Template not found' } };

    const beforeValue = existing.rows[0];
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    const fieldMap: Record<string, string> = { display_name: 'display_name', description: 'description', system_prompt: 'system_prompt', user_prompt_template: 'user_prompt_template', tone: 'tone', target_audience: 'target_audience', temperature: 'temperature', max_output_tokens: 'max_output_tokens', example_input: 'example_input', example_output: 'example_output' };
    for (const [key, col] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) { updates.push(`${col} = $${paramIdx++}`); params.push(body[key]); }
    }

    if (updates.length === 0) return { status: 400, jsonBody: { success: false, error: 'No fields to update' } };
    updates.push(`updated_at = NOW()`);

    const result = await pool.query(
      `UPDATE ai_prompt_templates SET ${updates.join(', ')} WHERE organization_id IS NULL AND is_default = true AND template_key = $${paramIdx} RETURNING *`,
      [...params, templateKey]
    );

    await logAuditAction(auth.superAdminId!, 'UPDATE_AI_PROMPT_TEMPLATE', 'ai_prompt_template', result.rows[0].id,
      { tone: beforeValue.tone, temperature: beforeValue.temperature },
      { tone: body.tone || beforeValue.tone, temperature: body.temperature || beforeValue.temperature },
      `Updated system default template: ${templateKey}`
    );

    return { status: 200, jsonBody: { success: true, data: result.rows[0] } };
  } catch (err) {
    context.error('updateAIPromptTemplate error:', err instanceof Error ? err.message : String(err));
    return { status: 500, jsonBody: { success: false, error: err instanceof Error ? err.message : 'Internal error' } };
  }
}

app.http('listAIPromptTemplates', { methods: ['GET'], authLevel: 'anonymous', route: 'ai-prompt-templates', handler: listAIPromptTemplates });
app.http('getAIPromptTemplate', { methods: ['GET'], authLevel: 'anonymous', route: 'ai-prompt-templates/{templateKey}', handler: getAIPromptTemplate });
app.http('updateAIPromptTemplate', { methods: ['PUT'], authLevel: 'anonymous', route: 'ai-prompt-templates/{templateKey}', handler: updateAIPromptTemplate });
