import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

export interface AIUsageSummary {
  totals: {
    total_requests: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
    total_cost_usd: number;
    avg_latency_ms: number;
  };
  by_org: Array<{ org_name: string; subdomain: string; requests: string; tokens: string; cost_usd: string }>;
  by_operation: Array<{ operation: string; requests: string; tokens: string; cost_usd: string }>;
  by_provider: Array<{ provider: string; requests: string; cost_usd: string }>;
  daily_usage: Array<{ date: string; requests: string; cost_usd: string; tokens: string }>;
  provider_split: { platform_default: number; byoai: number };
}

export function useAIUsageSummary(period: string = 'current_month') {
  return useQuery<AIUsageSummary>({
    queryKey: ['ai-usage-summary', period],
    queryFn: async () => {
      const { data } = await apiClient.get(`/ai-usage/summary?period=${period}`);
      return data;
    },
  });
}
