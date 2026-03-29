import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

export interface PlatformStats {
  organizations: {
    total: string;
    active: string;
    inactive: string;
    suspended: string;
    beta: string;
  };
  users: {
    total: string;
    active: string;
    inactive: string;
    locked: string;
  };
  programmes: { total: string };
  reports: { total: string };
  recentActivity: {
    newOrgs30d: number;
    newUsers30d: number;
  };
  subscriptions: Array<{ subscription_tier: string; count: string }>;
}

export function usePlatformStats() {
  return useQuery<PlatformStats>({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/platform-stats');
      return data;
    },
  });
}
