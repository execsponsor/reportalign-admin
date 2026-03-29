import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';
import type { Pagination } from './useOrganizations';

export interface AuditEntry {
  id: string;
  action_type: string;
  target_type: string;
  target_id: string | null;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  reason: string | null;
  ip_address: string | null;
  session_id: string | null;
  created_at: string;
  admin_email: string;
  admin_first_name: string;
  admin_last_name: string;
}

interface AuditFilters {
  page?: number;
  limit?: number;
  adminEmail?: string;
  actionType?: string;
  fromDate?: string;
  toDate?: string;
}

export function useAuditLog(filters: AuditFilters = {}) {
  return useQuery<{ entries: AuditEntry[]; pagination: Pagination }>({
    queryKey: ['audit-log', filters],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (filters.page) query.set('page', String(filters.page));
      if (filters.limit) query.set('limit', String(filters.limit));
      if (filters.adminEmail) query.set('adminEmail', filters.adminEmail);
      if (filters.actionType) query.set('actionType', filters.actionType);
      if (filters.fromDate) query.set('fromDate', filters.fromDate);
      if (filters.toDate) query.set('toDate', filters.toDate);
      const { data } = await apiClient.get(`/audit-log?${query}`);
      return data;
    },
  });
}
