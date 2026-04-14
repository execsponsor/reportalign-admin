/**
 * AI Usage & Cost Azure Functions
 * Cross-organisation AI usage monitoring
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateSuperAdmin } from '../middleware/auth.js';
import { getPool } from '../utils/database.js';

// ============================================================================
// GET /api/ai-usage/summary — Platform-wide AI usage summary
// ============================================================================

async function getAIUsageSummary(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const pool = getPool();
  const period = req.query.get('period') || 'current_month';

  let dateFilter: string;
  if (period === 'last_month') {
    dateFilter = `created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month') AND created_at < DATE_TRUNC('month', NOW())`;
  } else if (period === 'last_3_months') {
    dateFilter = `created_at >= DATE_TRUNC('month', NOW() - INTERVAL '3 months')`;
  } else {
    dateFilter = `created_at >= DATE_TRUNC('month', NOW())`;
  }

  // Total platform stats
  const totals = await pool.query(
    `SELECT COUNT(*) as total_requests,
            COUNT(*) FILTER (WHERE estimated_cost_usd IS NOT NULL) as costed_requests,
            COALESCE(SUM(input_tokens), 0) as total_input_tokens,
            COALESCE(SUM(output_tokens), 0) as total_output_tokens,
            COALESCE(SUM(total_tokens), 0) as total_tokens,
            COALESCE(SUM(estimated_cost_usd), 0) as total_cost_usd,
            COALESCE(AVG(latency_ms), 0) as avg_latency_ms
     FROM ai_usage_log WHERE ${dateFilter}`
  );

  // Usage by organisation (top 15)
  const byOrg = await pool.query(
    `SELECT o.name as org_name, o.subdomain,
            COUNT(*) as requests,
            COALESCE(SUM(a.total_tokens), 0) as tokens,
            COALESCE(SUM(a.estimated_cost_usd), 0) as cost_usd
     FROM ai_usage_log a
     JOIN organizations o ON a.organization_id = o.id
     WHERE ${dateFilter.replace(/created_at/g, 'a.created_at')}
     GROUP BY o.id, o.name, o.subdomain
     ORDER BY cost_usd DESC
     LIMIT 15`
  );

  // Usage by operation
  const byOperation = await pool.query(
    `SELECT operation, COUNT(*) as requests,
            COALESCE(SUM(total_tokens), 0) as tokens,
            COALESCE(SUM(estimated_cost_usd), 0) as cost_usd
     FROM ai_usage_log WHERE ${dateFilter}
     GROUP BY operation ORDER BY requests DESC`
  );

  // Usage by provider
  const byProvider = await pool.query(
    `SELECT COALESCE(provider_id, 'platform-default') as provider,
            COUNT(*) as requests,
            COALESCE(SUM(estimated_cost_usd), 0) as cost_usd
     FROM ai_usage_log WHERE ${dateFilter}
     GROUP BY provider_id ORDER BY requests DESC`
  );

  // Daily usage (last 30 days)
  const dailyUsage = await pool.query(
    `SELECT DATE(created_at) as date,
            COUNT(*) as requests,
            COALESCE(SUM(estimated_cost_usd), 0) as cost_usd,
            COALESCE(SUM(total_tokens), 0) as tokens
     FROM ai_usage_log
     WHERE created_at >= NOW() - INTERVAL '30 days'
     GROUP BY DATE(created_at) ORDER BY date`
  );

  // Orgs using BYOAI vs platform default
  const providerSplit = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE is_platform_default = true OR is_platform_default IS NULL) as platform_default,
       COUNT(*) FILTER (WHERE is_platform_default = false) as byoai
     FROM ai_usage_log WHERE ${dateFilter}`
  );

  const row = totals.rows[0];

  return {
    status: 200,
    jsonBody: {
      success: true,
      data: {
        totals: {
          total_requests: parseInt(row.total_requests),
          total_input_tokens: parseInt(row.total_input_tokens),
          total_output_tokens: parseInt(row.total_output_tokens),
          total_tokens: parseInt(row.total_tokens),
          total_cost_usd: parseFloat(row.total_cost_usd),
          avg_latency_ms: Math.round(parseFloat(row.avg_latency_ms)),
        },
        by_org: byOrg.rows,
        by_operation: byOperation.rows,
        by_provider: byProvider.rows,
        daily_usage: dailyUsage.rows,
        provider_split: {
          platform_default: parseInt(providerSplit.rows[0].platform_default),
          byoai: parseInt(providerSplit.rows[0].byoai),
        },
      },
    },
  };
}

// ============================================================================
// Register routes
// ============================================================================

app.http('getAIUsageSummary', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'ai-usage/summary',
  handler: getAIUsageSummary,
});
