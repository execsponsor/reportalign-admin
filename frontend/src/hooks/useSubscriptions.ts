import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

export interface SubscriptionOverview {
  by_tier: Array<{ subscription_tier: string; count: string }>;
  by_status: Array<{ subscription_status: string; count: string }>;
  beta_customers: Array<{
    id: string; name: string; subdomain: string; subscription_tier: string;
    beta_start_date: string | null; beta_expiration_date: string | null; beta_notes: string | null;
    days_remaining: string | null; user_count: string;
  }>;
  approaching_limits: Array<{
    id: string; name: string; subdomain: string; max_users: number; max_programmes: number;
    subscription_tier: string; current_users: string; current_programmes: string;
  }>;
  recent_orgs: Array<{
    id: string; name: string; subdomain: string; subscription_tier: string;
    subscription_status: string; is_beta_customer: boolean; created_at: string; user_count: string;
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
