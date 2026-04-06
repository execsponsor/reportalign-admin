/**
 * Organization Management Azure Functions
 * CRUD operations for organizations
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateSuperAdmin, logAuditAction } from '../middleware/auth';
import { getPool } from '../utils/database';
import { generatePassword, hashPassword, hashEmail } from '../utils/crypto';
import {
  createOrganizationSchema,
  paginationSchema,
  SUBSCRIPTION_LIMITS,
} from '../utils/validation';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// GET /api/organizations — List organizations
// ============================================================================

async function listOrganizations(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const params = paginationSchema.parse(Object.fromEntries(req.query));
  const pool = getPool();
  const offset = (params.page - 1) * params.limit;

  let whereClause = 'WHERE 1=1';
  const queryParams: unknown[] = [];
  let paramIdx = 1;

  if (params.status) {
    whereClause += ` AND o.subscription_status = $${paramIdx++}`;
    queryParams.push(params.status);
  }
  if (params.tier) {
    whereClause += ` AND o.subscription_tier = $${paramIdx++}`;
    queryParams.push(params.tier);
  }
  if (params.search) {
    whereClause += ` AND (o.name ILIKE $${paramIdx} OR o.subdomain ILIKE $${paramIdx})`;
    queryParams.push(`%${params.search}%`);
    paramIdx++;
  }

  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM organizations o ${whereClause}`,
    queryParams
  );

  const orgsResult = await pool.query(
    `SELECT o.id, o.name, o.subdomain, o.organization_type, o.is_active,
            o.subscription_tier, o.subscription_status, o.max_users, o.max_programmes,
            o.is_beta_customer, o.created_at,
            (SELECT COUNT(*) FROM organization_users ou WHERE ou.organization_id = o.id AND ou.is_active = true) as user_count,
            (SELECT COUNT(*) FROM programmes p WHERE p.organization_id = o.id AND p.deleted_at IS NULL) as programme_count
     FROM organizations o
     ${whereClause}
     ORDER BY o.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
    [...queryParams, params.limit, offset]
  );

  return {
    status: 200,
    jsonBody: {
      success: true,
      data: {
        organizations: orgsResult.rows,
        pagination: {
          page: params.page,
          limit: params.limit,
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(parseInt(countResult.rows[0].total) / params.limit),
        },
      },
    },
  };
}

// ============================================================================
// GET /api/organizations/:id — View organization details
// ============================================================================

async function getOrganization(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const id = req.params.id;
  const pool = getPool();

  // Use UUID check to avoid type mismatch on subdomain column
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
  const whereClause = isUuid ? 'WHERE o.id = $1' : 'WHERE o.subdomain = $1';

  const orgResult = await pool.query(
    `SELECT o.*,
            (SELECT COUNT(*) FROM organization_users ou WHERE ou.organization_id = o.id AND ou.is_active = true) as user_count,
            (SELECT COUNT(*) FROM programmes p WHERE p.organization_id = o.id AND p.deleted_at IS NULL) as programme_count,
            (SELECT json_build_object('email', u.email, 'first_name', u.first_name, 'last_name', u.last_name, 'last_login', u.last_login)
             FROM users u JOIN organization_users ou ON u.id = ou.user_id
             WHERE ou.organization_id = o.id AND ou.access_level = 'administrator' AND ou.is_active = true
             LIMIT 1) as admin_info
     FROM organizations o
     ${whereClause}`,
    [id]
  );

  if (orgResult.rows.length === 0) {
    return { status: 404, jsonBody: { error: 'Organization not found' } };
  }

  return { status: 200, jsonBody: { success: true, data: orgResult.rows[0] } };
}

// ============================================================================
// POST /api/organizations — Create organization with full provisioning
// ============================================================================

async function createOrganization(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const body = await req.json() as Record<string, unknown>;
  const data = createOrganizationSchema.parse(body);
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check subdomain uniqueness
    const existing = await client.query(
      'SELECT id FROM organizations WHERE subdomain = $1',
      [data.subdomain]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return { status: 409, jsonBody: { error: 'Subdomain already exists' } };
    }

    const limits = SUBSCRIPTION_LIMITS[data.subscriptionTier] || SUBSCRIPTION_LIMITS.standard;
    const orgId = uuidv4();
    const password = generatePassword();
    const passwordHash = await hashPassword(password);
    const emailHash = hashEmail(data.adminEmail);

    // 1. Create organization
    await client.query(
      `INSERT INTO organizations (id, name, subdomain, organization_type, is_active,
        max_users, max_programmes, subscription_tier, subscription_status,
        is_beta_customer, primary_brand_color, granted_by_super_admin_id)
       VALUES ($1, $2, $3, $4, true, $5, $6, $7, 'active', $8, '#1E40AF', $9)`,
      [orgId, data.name, data.subdomain, data.organizationType,
       limits.maxUsers, limits.maxProgrammes, data.subscriptionTier,
       data.subscriptionTier === 'beta_customer', auth.superAdminId]
    );

    // 2. Create or reuse admin user
    let userId: string;
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [data.adminEmail]
    );

    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      // Update password for existing user
      await client.query(
        'UPDATE users SET password_hash = $1, email_hash = $2, is_active = true WHERE id = $3',
        [passwordHash, emailHash, userId]
      );
    } else {
      userId = uuidv4();
      await client.query(
        `INSERT INTO users (id, email, password_hash, email_hash, first_name, last_name, is_active, email_verified)
         VALUES ($1, $2, $3, $4, 'Admin', 'User', true, true)`,
        [userId, data.adminEmail, passwordHash, emailHash]
      );
    }

    // 3. Link user to organization
    await client.query(
      `INSERT INTO organization_users (organization_id, user_id, access_level, role, is_active)
       VALUES ($1, $2, 'administrator', 'administrator', true)`,
      [orgId, userId]
    );

    // 4. Create organization settings
    await client.query(
      `INSERT INTO organization_settings (organization_id, terminology_config, rag_definitions, outcome_framework, fiscal_year_start_month)
       VALUES ($1, '{"programme": "Programme", "programmes": "Programmes", "workstream": "Workstream", "workstreams": "Workstreams"}'::jsonb,
               '{"red": {"description": "Critical issues requiring immediate attention", "label": "Critical"},
                 "amber": {"description": "Some risks or concerns identified", "label": "At Risk"},
                 "green": {"description": "On track and progressing as planned", "label": "On Track"}}'::jsonb,
               'Balanced Scorecard', 4)`,
      [orgId]
    );

    // 5. Create portfolio grouping config
    await client.query(
      `INSERT INTO portfolio_grouping_config (organization_id, grouping_enabled, level_1_enabled, level_1_name, level_2_enabled, level_2_name)
       VALUES ($1, false, false, 'Division', false, 'Department')`,
      [orgId]
    );

    // 6. Create default workflow
    const draftId = uuidv4(), inReviewId = uuidv4(), submittedId = uuidv4(), approvedId = uuidv4(), rejectedId = uuidv4();
    const steps = [
      [draftId, 'Draft', 1, true, false, null, '#6B7280'],
      [inReviewId, 'In Review', 2, false, false, null, '#3B82F6'],
      [submittedId, 'Submitted', 3, false, false, null, '#EAB308'],
      [approvedId, 'Approved', 4, false, true, 'approved', '#22C55E'],
      [rejectedId, 'Rejected', 5, false, true, 'rejected', '#EF4444'],
    ];
    for (const [id, name, order, isInitial, isTerminal, terminalType, color] of steps) {
      await client.query(
        `INSERT INTO workflow_steps (id, organization_id, name, sequence_order, is_initial, is_terminal, terminal_type, color)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, orgId, name, order, isInitial, isTerminal, terminalType, color]
      );
    }

    // Workflow transitions
    const transitions = [
      [draftId, inReviewId, 'Submit for Review', 'outline', '{Owner,Contributor}'],
      [draftId, submittedId, 'Submit for Approval', 'default', '{Owner,Contributor}'],
      [inReviewId, draftId, 'Return to Draft', 'outline', '{Executive,Owner}'],
      [inReviewId, submittedId, 'Submit for Approval', 'default', '{Owner,Contributor}'],
      [submittedId, approvedId, 'Approve', 'success', '{Executive}'],
      [submittedId, rejectedId, 'Reject', 'destructive', '{Executive}'],
      [submittedId, inReviewId, 'Request Changes', 'secondary', '{Executive}'],
    ];
    for (const [from, to, label, variant, roles] of transitions) {
      await client.query(
        `INSERT INTO workflow_transitions (organization_id, from_step_id, to_step_id, button_label, button_variant, allowed_roles)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orgId, from, to, label, variant, roles]
      );
    }

    await client.query('COMMIT');

    // Audit log
    await logAuditAction(auth.superAdminId!, 'CREATE_ORGANIZATION', 'organization', orgId, null, {
      name: data.name, subdomain: data.subdomain, tier: data.subscriptionTier, adminEmail: data.adminEmail,
    });

    return {
      status: 201,
      jsonBody: {
        success: true,
        data: {
          organizationId: orgId,
          subdomain: data.subdomain,
          url: `https://${data.subdomain}.execsponsor.com`,
          adminEmail: data.adminEmail,
          adminPassword: password,
          userId,
          subscription: { tier: data.subscriptionTier, maxUsers: limits.maxUsers, maxProgrammes: limits.maxProgrammes },
        },
        message: 'Organization created successfully. Save the admin password — it will not be shown again.',
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    context.error('Create org error:', err);
    return { status: 500, jsonBody: { error: 'Failed to create organization' } };
  } finally {
    client.release();
  }
}

// ============================================================================
// PATCH /api/organizations/:id — Update organization
// ============================================================================

async function updateOrganization(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = await authenticateSuperAdmin(req, context);
  if (!auth.authenticated) return { status: 401, jsonBody: { error: auth.error } };

  const id = req.params.id;
  const body = await req.json() as Record<string, unknown>;
  const pool = getPool();

  // Get current state for audit
  const current = await pool.query('SELECT * FROM organizations WHERE id = $1', [id]);
  if (current.rows.length === 0) return { status: 404, jsonBody: { error: 'Organization not found' } };

  const updates: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (body.subscriptionStatus !== undefined) {
    updates.push(`subscription_status = $${paramIdx++}`);
    params.push(body.subscriptionStatus);
  }
  if (body.subscriptionTier !== undefined) {
    updates.push(`subscription_tier = $${paramIdx++}`);
    params.push(body.subscriptionTier);
    const limits = SUBSCRIPTION_LIMITS[body.subscriptionTier as string];
    if (limits) {
      updates.push(`max_users = $${paramIdx++}`);
      params.push(limits.maxUsers);
      updates.push(`max_programmes = $${paramIdx++}`);
      params.push(limits.maxProgrammes);
    }
  }
  if (body.isActive !== undefined) {
    updates.push(`is_active = $${paramIdx++}`);
    params.push(body.isActive);
  }

  if (updates.length === 0) return { status: 400, jsonBody: { error: 'No fields to update' } };

  updates.push(`updated_at = NOW()`);
  params.push(id);

  await pool.query(
    `UPDATE organizations SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
    params
  );

  await logAuditAction(auth.superAdminId!, 'UPDATE_ORGANIZATION', 'organization', id,
    current.rows[0], body as Record<string, unknown>, body.reason as string);

  return { status: 200, jsonBody: { success: true, message: 'Organization updated' } };
}

// ============================================================================
// Register routes
// ============================================================================

app.http('listOrganizations', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'organizations',
  handler: listOrganizations,
});

app.http('getOrganization', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'organizations/{id}',
  handler: getOrganization,
});

app.http('createOrganization', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'organizations',
  handler: createOrganization,
});

app.http('updateOrganization', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'organizations/{id}',
  handler: updateOrganization,
});
