/**
 * NPS Survey Admin Azure Functions
 * Platform-wide NPS data aggregated by organization
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateSuperAdmin } from '../middleware/auth';
import { getPool } from '../utils/database';


// ============================================================================
// GET /api/nps-surveys — Platform-wide NPS summary by org
// ============================================================================

async function listNpsSurveys(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  try {
    const pool = getPool();

    // Overall platform stats
    const platformResult = await pool.query(
      `SELECT
         COUNT(*) AS total_responses,
         COALESCE(AVG(score), 0) AS avg_score,
         COUNT(*) FILTER (WHERE score >= 9) AS promoters,
         COUNT(*) FILTER (WHERE score >= 7 AND score <= 8) AS passives,
         COUNT(*) FILTER (WHERE score <= 6) AS detractors
       FROM nps_surveys
       WHERE dismissed = false AND score IS NOT NULL`
    );

    const platform = platformResult.rows[0];
    const totalResponses = parseInt(platform.total_responses, 10);
    const promoters = parseInt(platform.promoters, 10);
    const detractors = parseInt(platform.detractors, 10);
    const platformNps = totalResponses > 0
      ? Math.round(((promoters - detractors) / totalResponses) * 100)
      : 0;

    // Per-org breakdown
    const orgResult = await pool.query(
      `SELECT
         o.id AS org_id,
         o.name AS org_name,
         o.subdomain,
         COUNT(ns.id) AS response_count,
         COALESCE(AVG(ns.score), 0) AS avg_score,
         COUNT(*) FILTER (WHERE ns.score >= 9) AS promoters,
         COUNT(*) FILTER (WHERE ns.score >= 7 AND ns.score <= 8) AS passives,
         COUNT(*) FILTER (WHERE ns.score <= 6) AS detractors,
         MAX(ns.created_at) AS latest_response
       FROM organizations o
       LEFT JOIN nps_surveys ns ON ns.organization_id = o.id AND ns.dismissed = false AND ns.score IS NOT NULL
       GROUP BY o.id, o.name, o.subdomain
       HAVING COUNT(ns.id) > 0
       ORDER BY COUNT(ns.id) DESC`
    );

    const byOrg = orgResult.rows.map((row) => {
      const total = parseInt(row.response_count, 10);
      const p = parseInt(row.promoters, 10);
      const d = parseInt(row.detractors, 10);
      return {
        orgId: row.org_id,
        orgName: row.org_name,
        subdomain: row.subdomain,
        responseCount: total,
        avgScore: Math.round(parseFloat(row.avg_score) * 10) / 10,
        npsScore: total > 0 ? Math.round(((p - d) / total) * 100) : 0,
        promoters: p,
        passives: parseInt(row.passives, 10),
        detractors: d,
        latestResponse: row.latest_response,
      };
    });

    // Monthly trend (last 12 months)
    const trendResult = await pool.query(
      `SELECT
         TO_CHAR(created_at, 'YYYY-MM') AS month,
         COUNT(*) AS response_count,
         COALESCE(AVG(score), 0) AS avg_score,
         COUNT(*) FILTER (WHERE score >= 9) AS promoters,
         COUNT(*) FILTER (WHERE score <= 6) AS detractors
       FROM nps_surveys
       WHERE dismissed = false AND score IS NOT NULL
         AND created_at >= NOW() - INTERVAL '12 months'
       GROUP BY TO_CHAR(created_at, 'YYYY-MM')
       ORDER BY month`
    );

    const trend = trendResult.rows.map((row) => {
      const total = parseInt(row.response_count, 10);
      const p = parseInt(row.promoters, 10);
      const d = parseInt(row.detractors, 10);
      return {
        month: row.month,
        responseCount: total,
        avgScore: Math.round(parseFloat(row.avg_score) * 10) / 10,
        npsScore: total > 0 ? Math.round(((p - d) / total) * 100) : 0,
      };
    });

    // Latest verbatim feedback (last 20)
    const feedbackResult = await pool.query(
      `SELECT
         ns.score,
         ns.feedback_text,
         ns.role,
         ns.created_at,
         o.name AS org_name,
         u.first_name,
         u.last_name
       FROM nps_surveys ns
       JOIN organizations o ON o.id = ns.organization_id
       JOIN users u ON u.id = ns.user_id
       WHERE ns.dismissed = false AND ns.score IS NOT NULL AND ns.feedback_text IS NOT NULL
         AND ns.feedback_text != ''
       ORDER BY ns.created_at DESC
       LIMIT 20`
    );

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          platform: {
            totalResponses,
            avgScore: Math.round(parseFloat(platform.avg_score) * 10) / 10,
            npsScore: platformNps,
            promoters,
            passives: parseInt(platform.passives, 10),
            detractors,
          },
          byOrg,
          trend,
          latestFeedback: feedbackResult.rows,
        },
      },
    };
  } catch (error) {
    context.error('Error fetching NPS surveys', error);
    return { status: 500, jsonBody: { error: 'Failed to fetch NPS data' } };
  }
}

// ============================================================================
// GET /api/nps-surveys/:orgId — Detailed NPS for one org
// ============================================================================

async function getOrgNpsSurveys(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  try {
    const orgId = req.params.orgId;
    if (!orgId) return { status: 400, jsonBody: { error: 'orgId required' } };

    const pool = getPool();

    // Org info
    const orgResult = await pool.query(
      `SELECT id, name, subdomain FROM organizations WHERE id = $1`,
      [orgId]
    );
    if (orgResult.rows.length === 0) {
      return { status: 404, jsonBody: { error: 'Organization not found' } };
    }

    // Stats
    const statsResult = await pool.query(
      `SELECT
         COUNT(*) AS total_responses,
         COALESCE(AVG(score), 0) AS avg_score,
         COUNT(*) FILTER (WHERE score >= 9) AS promoters,
         COUNT(*) FILTER (WHERE score >= 7 AND score <= 8) AS passives,
         COUNT(*) FILTER (WHERE score <= 6) AS detractors
       FROM nps_surveys
       WHERE organization_id = $1 AND dismissed = false AND score IS NOT NULL`,
      [orgId]
    );

    const stats = statsResult.rows[0];
    const totalResponses = parseInt(stats.total_responses, 10);
    const promoters = parseInt(stats.promoters, 10);
    const detractors = parseInt(stats.detractors, 10);

    // Monthly trend
    const trendResult = await pool.query(
      `SELECT
         TO_CHAR(created_at, 'YYYY-MM') AS month,
         COUNT(*) AS response_count,
         COALESCE(AVG(score), 0) AS avg_score,
         COUNT(*) FILTER (WHERE score >= 9) AS promoters,
         COUNT(*) FILTER (WHERE score <= 6) AS detractors
       FROM nps_surveys
       WHERE organization_id = $1 AND dismissed = false AND score IS NOT NULL
         AND created_at >= NOW() - INTERVAL '12 months'
       GROUP BY TO_CHAR(created_at, 'YYYY-MM')
       ORDER BY month`,
      [orgId]
    );

    const trend = trendResult.rows.map((row) => {
      const total = parseInt(row.response_count, 10);
      const p = parseInt(row.promoters, 10);
      const d = parseInt(row.detractors, 10);
      return {
        month: row.month,
        responseCount: total,
        avgScore: Math.round(parseFloat(row.avg_score) * 10) / 10,
        npsScore: total > 0 ? Math.round(((p - d) / total) * 100) : 0,
      };
    });

    // All responses with feedback
    const responsesResult = await pool.query(
      `SELECT
         ns.id, ns.score, ns.feedback_text, ns.role, ns.dismissed, ns.created_at,
         u.first_name, u.last_name, u.email
       FROM nps_surveys ns
       JOIN users u ON u.id = ns.user_id
       WHERE ns.organization_id = $1 AND ns.dismissed = false AND ns.score IS NOT NULL
       ORDER BY ns.created_at DESC
       LIMIT 100`,
      [orgId]
    );

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          organization: orgResult.rows[0],
          stats: {
            totalResponses,
            avgScore: Math.round(parseFloat(stats.avg_score) * 10) / 10,
            npsScore: totalResponses > 0 ? Math.round(((promoters - detractors) / totalResponses) * 100) : 0,
            promoters,
            passives: parseInt(stats.passives, 10),
            detractors,
          },
          trend,
          responses: responsesResult.rows,
        },
      },
    };
  } catch (error) {
    context.error('Error fetching org NPS data', error);
    return { status: 500, jsonBody: { error: 'Failed to fetch org NPS data' } };
  }
}

// ============================================================================
// REGISTER FUNCTIONS
// ============================================================================

app.http('listNpsSurveys', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'nps-surveys',
  handler: listNpsSurveys,
});

app.http('getOrgNpsSurveys', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'nps-surveys/{orgId}',
  handler: getOrgNpsSurveys,
});
