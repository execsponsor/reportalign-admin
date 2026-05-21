import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
}

export interface RuleStats {
  totalOrganizations: number;
  byType: Array<{ contradictionType: string; ruleCount: number }>;
}

export interface CreateRuleInput {
  ruleCode: string;
  name: string;
  contradictionType: string;
  indicators?: string[];
  triggerLogic: string;
  whyItMatters?: string;
  surfacedText: string;
  outcomeRelevance?: string[];
  enabled?: boolean;
}

export interface UpdateRuleInput {
  name?: string;
  triggerLogic?: string;
  whyItMatters?: string;
  surfacedText?: string;
  indicators?: string[];
  outcomeRelevance?: string[];
  enabled?: boolean;
}

export function useSignalDetectionRules() {
  return useQuery<SignalDetectionRule[]>({
    queryKey: ['admin', 'signal-detection-rules'],
    queryFn: async () => {
      const res = await apiClient.get('/api/signal-detection-rules');
      return res.data?.data || res.data || [];
    },
    staleTime: 30 * 1000,
  });
}

export function useRuleStats() {
  return useQuery<RuleStats>({
    queryKey: ['admin', 'signal-detection-rules', 'stats'],
    queryFn: async () => {
      const res = await apiClient.get('/api/signal-detection-rules/stats');
      return res.data?.data || res.data;
    },
    staleTime: 30 * 1000,
  });
}

export function useCreateMasterRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRuleInput) => {
      const res = await apiClient.post('/api/signal-detection-rules', input);
      return res.data?.data || res.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'signal-detection-rules'] }); },
  });
}

export function useUpdateMasterRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ruleId, data }: { ruleId: string; data: UpdateRuleInput }) => {
      const res = await apiClient.patch(`/api/signal-detection-rules/${ruleId}`, data);
      return res.data?.data || res.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'signal-detection-rules'] }); },
  });
}

export function useDeleteMasterRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await apiClient.delete(`/api/signal-detection-rules/${ruleId}`);
      return res.data?.data || res.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'signal-detection-rules'] }); },
  });
}

export function usePushRuleToOrgs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await apiClient.post(`/api/signal-detection-rules/${ruleId}/push`);
      return res.data?.data || res.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'signal-detection-rules'] }); },
  });
}
