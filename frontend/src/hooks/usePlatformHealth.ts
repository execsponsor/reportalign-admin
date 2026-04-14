import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

export interface PlatformHealth {
  database: {
    status: string;
    latency_ms: number;
    server_time: string;
    size: string;
    size_bytes: number;
    connections: { total: string; active: string; idle: string; idle_in_transaction: string };
    pool: { totalCount: number; idleCount: number; waitingCount: number };
  };
  table_sizes: Array<{ table_name: string; total_size: string; size_bytes: string; row_count: string }>;
  platform: {
    active_orgs: string;
    total_orgs: string;
    active_users: string;
    total_users: string;
    active_programmes: string;
    total_reports: string;
    reports_24h: string;
    logins_24h: string;
    security_events_24h: string;
    ai_requests_24h: string;
  };
  process: {
    uptime_seconds: number;
    node_version: string;
    memory: { heap_used_mb: number; heap_total_mb: number; rss_mb: number };
  };
}

export function usePlatformHealth() {
  return useQuery<PlatformHealth>({
    queryKey: ['platform-health'],
    queryFn: async () => {
      const { data } = await apiClient.get('/platform-health');
      return data;
    },
    refetchInterval: 30000, // refresh every 30s
  });
}
