import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

export interface SubscriptionOverview {
  by_tier: Array<{ subscription_tier: string; count: string }>;
  by_status: Array<{ subscription_status: string; count: string }>;
  by_interval: Array<{ interval: string; count: string }>;
  active_trials: Array<{
    id: string; name: string; subdomain: string; subscription_tier: string;
    trial_ends_at: string; days_remaining: string; user_count: string;
  }>;
  expired_trials: Array<{ id: string; name: string; subdomain: string; trial_ends_at: string }>;
  approaching_limits: Array<{
    id: string; name: string; subdomain: string; max_users: number; max_programmes: number;
    subscription_tier: string; current_users: string; current_programmes: string;
  }>;
  recent_stripe_events: Array<{
    id: string; stripe_event_id: string; event_type: string; status: string;
    error_message: string | null; created_at: string; org_name: string | null; subdomain: string | null;
  }>;
}

export function useSubscriptionOverview() {
  return useQuery<SubscriptionOverview>({
    queryKey: ['subscription-overview'],
    queryFn: async () => {
      const { data } = await apiClient.get('/subscriptions/overview');
      return data;
    },
  });
}
