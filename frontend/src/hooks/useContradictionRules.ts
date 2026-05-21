import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

export interface SignalDetectionRule {
  id: string;
  ruleCode: string;
  name: string;
  contradictionType: string;
  indicators: string[];
  triggerLogic: string;
  whyItMatters: string;
  surfacedText: string;
  outcomeRelevance: string[];
  enabled: boolean;
  isSystemDefault: boolean;
  orgCount: number;
  disabledByOrgs: number;
  customVersions: number;
}

export interface RuleStats {
  totalOrganizations: number;
  byType: Array<{
    contradictionType: string;
    ruleCount: number;
    orgCount: number;
  }>;
}

export function useSignalDetectionRules() {
  return useQuery<SignalDetectionRule[]>({
    queryKey: ['admin', 'signal-detection-rules'],
    queryFn: async () => {
      const res = await apiClient.get('/api/signal-detection-rules');
      return res.data?.data || res.data || [];
    },
    staleTime: 60 * 1000,
  });
}

export function useRuleStats() {
  return useQuery<RuleStats>({
    queryKey: ['admin', 'signal-detection-rules', 'stats'],
    queryFn: async () => {
      const res = await apiClient.get('/api/signal-detection-rules/stats');
      return res.data?.data || res.data;
    },
    staleTime: 60 * 1000,
  });
}
