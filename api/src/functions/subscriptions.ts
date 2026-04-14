/**
 * Subscription & Billing Azure Functions
 * Cross-org subscription overview, trial tracking, MRR
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

  // Active trials with days remaining
  const activeTrials = await pool.query(
    `SELECT id, name, subdomain, subscription_tier, trial_ends_at,
            EXTRACT(DAY FROM trial_ends_at - NOW()) as days_remaining,
            (SELECT COUNT(*) FROM organization_users ou WHERE ou.organization_id = o.id AND ou.is_active = true) as user_count
     FROM organizations o
     WHERE subscription_status = 'trial' AND trial_ends_at IS NOT NULL AND trial_ends_at > NOW()
     ORDER BY trial_ends_at ASC`
  );

  // Recently expired trials (last 30 days)
  const expiredTrials = await pool.query(
    `SELECT id, name, subdomain, trial_ends_at
     FROM organizations
     WHERE subscription_status = 'trial' AND trial_ends_at IS NOT NULL AND trial_ends_at <= NOW()
       AND trial_ends_at >= NOW() - INTERVAL '30 days'
     ORDER BY trial_ends_at DESC`
  );

  // Billing interval breakdown
  const byInterval = await pool.query(
    `SELECT COALESCE(billing_interval, 'none') as interval, COUNT(*) as count
     FROM organizations
     WHERE subscription_status = 'active'
     GROUP BY billing_interval`
  );

  // Recent Stripe events (last 20)
  const recentStripeEvents = await pool.query(
    `SELECT se.id, se.stripe_event_id, se.event_type, se.status, se.error_message,
            se.created_at, o.name as org_name, o.subdomain
     FROM stripe_events se
     LEFT JOIN organizations o ON se.organization_id = o.id
     ORDER BY se.created_at DESC
     LIMIT 20`
  );

  // Orgs approaching limits
  const approachingLimits = await pool.query(
    `SELECT o.id, o.name, o.subdomain, o.max_users, o.max_programmes, o.subscription_tier,
            (SELECT COUNT(*) FROM organization_users ou WHERE ou.organization_id = o.id AND ou.is_active = true) as current_users,
            (SELECT COUNT(*) FROM programmes p WHERE p.organization_id = o.id AND p.deleted_at IS NULL) as current_programmes
     FROM organizations o
     WHERE o.is_active = true
     HAVING (SELECT COUNT(*) FROM organization_users ou WHERE ou.organization_id = o.id AND ou.is_active = true) >= o.max_users * 0.8
        OR (SELECT COUNT(*) FROM programmes p WHERE p.organization_id = o.id AND p.deleted_at IS NULL) >= o.max_programmes * 0.8
     ORDER BY o.name`
  );

  return {
    status: 200,
    jsonBody: {
      success: true,
      data: {
        by_tier: byTier.rows,
        by_status: byStatus.rows,
        by_interval: byInterval.rows,
        active_trials: activeTrials.rows,
        expired_trials: expiredTrials.rows,
        approaching_limits: approachingLimits.rows,
        recent_stripe_events: recentStripeEvents.rows,
      },
    },
  };
}

app.http('getSubscriptionOverview', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'subscriptions/overview',
  handler: getSubscriptionOverview,
});
