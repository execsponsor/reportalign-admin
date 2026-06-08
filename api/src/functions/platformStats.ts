/**
 * Platform Statistics Azure Function
 * GET /api/platform-stats
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateSuperAdmin } from '../middleware/auth';
import { getPool } from '../utils/database';
import { snakeToCamel } from '../utils/caseTransform';

async function platformStats(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  try {
    const pool = getPool();

    const [orgs, users, programmes, reports, recentOrgs, recentUsers] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active,
          COUNT(*) FILTER (WHERE is_active = false) as inactive,
          COUNT(*) FILTER (WHERE subscription_status = 'suspended') as suspended,
          COUNT(*) FILTER (WHERE is_beta_customer = true) as beta
        FROM organizations
      `),
      pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active,
          COUNT(*) FILTER (WHERE is_active = false) as inactive,
          COUNT(*) FILTER (WHERE locked_until IS NOT NULL AND locked_until > NOW()) as locked
        FROM users
      `),
      pool.query('SELECT COUNT(*) as total FROM programmes WHERE deleted_at IS NULL'),
      pool.query('SELECT COUNT(*) as total FROM reports WHERE deleted_at IS NULL'),
      pool.query(`SELECT COUNT(*) as count FROM organizations WHERE created_at > NOW() - INTERVAL '30 days'`),
      pool.query(`SELECT COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL '30 days'`),
    ]);

    const subscriptions = await pool.query(`
      SELECT subscription_tier, COUNT(*) as count
      FROM organizations WHERE is_active = true
      GROUP BY subscription_tier ORDER BY count DESC
    `);

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          organizations: snakeToCamel(orgs.rows[0]),
          users: snakeToCamel(users.rows[0]),
          programmes: { total: parseInt(programmes.rows[0]?.total ?? '0') },
          reports: { total: parseInt(reports.rows[0]?.total ?? '0') },
          recentActivity: {
            newOrgs30d: parseInt(recentOrgs.rows[0]?.count ?? '0'),
            newUsers30d: parseInt(recentUsers.rows[0]?.count ?? '0'),
          },
          subscriptions: snakeToCamel(subscriptions.rows),
        },
      },
    };
  } catch (err) {
    context.error('platformStats error:', err instanceof Error ? err.message : String(err));
    return { status: 500, jsonBody: { success: false, error: err instanceof Error ? err.message : 'Internal error' } };
  }
}

app.http('platformStats', { methods: ['GET'], authLevel: 'function', route: 'platform-stats', handler: platformStats });
