/**
 * Validation schemas using Zod
 */

import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const subdomainSchema = z.string()
  .min(3, 'Subdomain must be at least 3 characters')
  .max(50, 'Subdomain must be at most 50 characters')
  .regex(
    /^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$/,
    'Subdomain must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric'
  );

export const emailSchema = z.string().email('Invalid email address');

export const organizationTypeSchema = z.enum([
  'corporate', 'public_sector', 'non_profit', 'healthcare', 'education', 'other',
]);

export const subscriptionTierSchema = z.enum([
  'standard', 'pro', 'max', 'beta_customer',
]);

export const subscriptionStatusSchema = z.enum([
  'active', 'trialing', 'past_due', 'cancelled', 'expired', 'suspended',
]);

export const accessLevelSchema = z.enum(['administrator', 'author', 'viewer']);

export const superAdminAccessLevelSchema = z.enum(['full_access', 'limited_access', 'read_only']);

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  subdomain: subdomainSchema,
  organizationType: organizationTypeSchema,
  adminEmail: emailSchema,
  subscriptionTier: subscriptionTierSchema,
});

export const createUserSchema = z.object({
  email: emailSchema,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  organizationId: uuidSchema,
  accessLevel: accessLevelSchema,
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
  tier: z.string().max(50).optional(),
});

export const auditLogFilterSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  adminEmail: z.string().optional(),
  organizationId: uuidSchema.optional(),
  actionType: z.string().max(50).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

// Subscription tier limits — override via env vars (e.g. STANDARD_MAX_USERS=10)
export const SUBSCRIPTION_LIMITS: Record<string, { maxUsers: number; maxProgrammes: number }> = {
  standard: {
    maxUsers: parseInt(process.env.STANDARD_MAX_USERS || '10'),
    maxProgrammes: parseInt(process.env.STANDARD_MAX_PROGRAMMES || '20'),
  },
  pro: {
    maxUsers: parseInt(process.env.PRO_MAX_USERS || '50'),
    maxProgrammes: parseInt(process.env.PRO_MAX_PROGRAMMES || '100'),
  },
  max: {
    maxUsers: parseInt(process.env.MAX_MAX_USERS || '999'),
    maxProgrammes: parseInt(process.env.MAX_MAX_PROGRAMMES || '999'),
  },
  beta_customer: {
    maxUsers: parseInt(process.env.BETA_MAX_USERS || '50'),
    maxProgrammes: parseInt(process.env.BETA_MAX_PROGRAMMES || '100'),
  },
};
