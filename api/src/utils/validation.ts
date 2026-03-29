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

// Subscription tier limits
export const SUBSCRIPTION_LIMITS: Record<string, { maxUsers: number; maxProgrammes: number }> = {
  standard: { maxUsers: 10, maxProgrammes: 20 },
  pro: { maxUsers: 50, maxProgrammes: 100 },
  max: { maxUsers: 999, maxProgrammes: 999 },
  beta_customer: { maxUsers: 50, maxProgrammes: 100 },
};
