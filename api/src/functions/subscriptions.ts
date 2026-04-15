/**
 * Subscription Overview Azure Functions
 * Cross-org subscription tiers, limits, and beta tracking
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateSuperAdmin } from '../middleware/auth.js';
import { getPool } from '../utils/database.js';

// ============================================================================
// GET /api/subscriptions/overview — Subscription dashboard
// ============================================================================

async function getSubscriptionOverview(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  try {
    const pool = getPool();

    // Subscription distribution by tier
    const byTier = await pool.query(
      `SELECT subscription_tier, COUNT(*) as count
       FROM organizations GROUP BY subscription_tier ORDER BY count DESC`
    );

    // Subscription distribution by status
    const byStatus = await pool.query(
      `SELECT subscription_status, COUNT(*) as count
       FROM organizations GROUP BY subscription_status ORDER BY count DESC`
    );

    // Beta customers with expiration tracking
    const betaCustomers = await pool.query(
      `SELECT id, name, subdomain, subscription_tier, beta_start_date, beta_expiration_date, beta_notes,
              CASE WHEN beta_expiration_date IS NOT NULL
                   THEN EXTRACT(DAY FROM beta_expiration_date - NOW())
                   ELSE NULL END as days_remaining,
              (SELECT COUNT(*) FROM organization_users ou WHERE ou.organization_id = o.id AND ou.is_active = true) as user_count
       FROM organizations o
       WHERE is_beta_customer = true AND is_active = true
       ORDER BY beta_expiration_date ASC NULLS LAST`
    );

    // Orgs approaching limits (>80% of max_users or max_programmes)
    const approachingLimits = await pool.query(
      `SELECT o.id, o.name, o.subdomain, o.max_users, o.max_programmes, o.subscription_tier,
              (SELECT COUNT(*) FROM organization_users ou WHERE ou.organization_id = o.id AND ou.is_active = true) as current_users,
              (SELECT COUNT(*) FROM programmes p WHERE p.organization_id = o.id AND p.deleted_at IS NULL) as current_programmes
       FROM organizations o
       WHERE o.is_active = true AND o.max_users > 0 AND o.max_programmes > 0
       ORDER BY o.name`
    );

    // Filter in JS to avoid HAVING with correlated subqueries
    const atLimit = approachingLimits.rows.filter((o) => {
      const userPct = parseInt(o.current_users) / o.max_users;
      const progPct = parseInt(o.current_programmes) / o.max_programmes;
      return userPct >= 0.8 || progPct >= 0.8;
    });

    // Recently created orgs (last 30 days)
    const recentOrgs = await pool.query(
      `SELECT id, name, subdomain, subscription_tier, subscription_status, is_beta_customer, created_at,
              (SELECT COUNT(*) FROM organization_users ou WHERE ou.organization_id = o.id AND ou.is_active = true) as user_count
       FROM organizations o
       WHERE created_at >= NOW() - INTERVAL '30 days'
       ORDER BY created_at DESC`
    );

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          by_tier: byTier.rows,
          by_status: byStatus.rows,
          beta_customers: betaCustomers.rows,
          approaching_limits: atLimit,
          recent_orgs: recentOrgs.rows,
        },
      },
    };
  } catch (err) {
    context.error('getSubscriptionOverview error:', err instanceof Error ? err.message : String(err));
    return { status: 500, jsonBody: { success: false, error: err instanceof Error ? err.message : 'Internal error' } };
  }
}

app.http('getSubscriptionOverview', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'subscriptions/overview',
  handler: getSubscriptionOverview,
});
