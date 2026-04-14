import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

export interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  email: string | null;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  reason: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface SecuritySummary {
  failed_logins_24h: number;
  lockouts_24h: number;
  by_severity_7d: Array<{ severity: string; count: string }>;
  by_type_7d: Array<{ event_type: string; count: string }>;
  top_ips_24h: Array<{ ip_address: string; count: string }>;
  top_emails_24h: Array<{ email: string; count: string }>;
  daily_counts_14d: Array<{ date: string; count: string }>;
}

interface ListParams {
  page?: number;
  limit?: number;
  severity?: string;
  eventType?: string;
  email?: string;
  ip?: string;
  fromDate?: string;
  toDate?: string;
}

export function useSecurityEvents(params: ListParams = {}) {
  return useQuery<{ events: SecurityEvent[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>({
    queryKey: ['security-events', params],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.severity) query.set('severity', params.severity);
      if (params.eventType) query.set('eventType', params.eventType);
      if (params.email) query.set('email', params.email);
      if (params.ip) query.set('ip', params.ip);
      if (params.fromDate) query.set('fromDate', params.fromDate);
      if (params.toDate) query.set('toDate', params.toDate);
      const { data } = await apiClient.get(`/security-events?${query}`);
      return data;
    },
  });
}

export function useSecuritySummary() {
  return useQuery<SecuritySummary>({
    queryKey: ['security-summary'],
    queryFn: async () => {
      const { data } = await apiClient.get('/security-events/summary');
      return data;
    },
    refetchInterval: 60000, // refresh every minute
  });
}
