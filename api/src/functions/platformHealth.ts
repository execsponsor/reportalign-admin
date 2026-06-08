/**
 * Platform Health Azure Functions
 * System health, database stats, and uptime monitoring
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateSuperAdmin } from '../middleware/auth';
import { getPool } from '../utils/database';
import { snakeToCamel } from '../utils/caseTransform';

async function getPlatformHealth(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  try {
    const pool = getPool();

    const dbStart = Date.now();
    const dbCheck = await pool.query('SELECT 1 as ok, NOW() as server_time');
    const dbLatencyMs = Date.now() - dbStart;

    const poolStats = { totalCount: pool.totalCount, idleCount: pool.idleCount, waitingCount: pool.waitingCount };

    const [dbSize, tableSizes, activeConnections, platformCounts, recentActivity] = await Promise.all([
      pool.query(`SELECT pg_database_size(current_database()) as size_bytes, pg_size_pretty(pg_database_size(current_database())) as size_pretty`),
      pool.query(`SELECT relname as table_name, pg_size_pretty(pg_total_relation_size(relid)) as total_size, pg_total_relation_size(relid) as size_bytes, n_live_tup as row_count FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 15`),
      pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE state = 'active') as active, COUNT(*) FILTER (WHERE state = 'idle') as idle, COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction FROM pg_stat_activity WHERE datname = current_database()`),
      pool.query(`SELECT (SELECT COUNT(*) FROM organizations WHERE is_active = true) as active_orgs, (SELECT COUNT(*) FROM organizations) as total_orgs, (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users, (SELECT COUNT(*) FROM users) as total_users, (SELECT COUNT(*) FROM programmes WHERE deleted_at IS NULL) as active_programmes, (SELECT COUNT(*) FROM reports) as total_reports`),
      pool.query(`SELECT (SELECT COUNT(*) FROM reports WHERE created_at >= NOW() - INTERVAL '24 hours') as reports_24h, (SELECT COUNT(*) FROM users WHERE last_login >= NOW() - INTERVAL '24 hours') as logins_24h, (SELECT COUNT(*) FROM security_events WHERE created_at >= NOW() - INTERVAL '24 hours') as security_events_24h, (SELECT COUNT(*) FROM ai_usage_log WHERE created_at >= NOW() - INTERVAL '24 hours') as ai_requests_24h`),
    ]);

    const mem = process.memoryUsage();

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          database: {
            status: dbCheck.rows[0].ok === 1 ? 'healthy' : 'error',
            latencyMs: dbLatencyMs,
            serverTime: dbCheck.rows[0].server_time,
            size: dbSize.rows[0].size_pretty,
            sizeBytes: parseInt(dbSize.rows[0].size_bytes),
            connections: snakeToCamel(activeConnections.rows[0]),
            pool: poolStats,
          },
          tableSizes: snakeToCamel(tableSizes.rows),
          platform: snakeToCamel({ ...platformCounts.rows[0], ...recentActivity.rows[0] }),
          process: {
            uptimeSeconds: Math.floor(process.uptime()),
            nodeVersion: process.version,
            memory: { heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024), heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024), rssMb: Math.round(mem.rss / 1024 / 1024) },
          },
        },
      },
    };
  } catch (err) {
    context.error('getPlatformHealth error:', err instanceof Error ? err.message : String(err));
    return { status: 500, jsonBody: { success: false, error: err instanceof Error ? err.message : 'Internal error' } };
  }
}

app.http('getPlatformHealth', { methods: ['GET'], authLevel: 'anonymous', route: 'platform-health', handler: getPlatformHealth });
