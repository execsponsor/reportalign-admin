import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

export interface ContradictionRule {
  id: string;
  rule_code: string;
  name: string;
  archetype: string;
  pack: string;
  rule_type: string;
  presentation_description: string | null;
  pm_challenge_text: string;
  exec_challenge_text: string;
  outcome_tags: string[];
  default_severity: string;
  escalate_after_cycles: number;
  escalate_to: string;
  is_active: boolean;
  is_mvp: boolean;
  override_count: number;
  // Conditions (from rule_conditions join)
  indicator_a: string | null;
  indicator_a_condition: string | null;
  indicator_b: string | null;
  indicator_b_condition: string | null;
  temporal_indicator: string | null;
  quality_dimension: string | null;
  portfolio_criterion: string | null;
  tunable_threshold_name: string | null;
  tunable_threshold_label: string | null;
  tunable_threshold_default: number | null;
  tunable_threshold_min: number | null;
  tunable_threshold_max: number | null;
  tunable_threshold_current: number | null;
}

export interface RuleStats {
  total: number;
  active: number;
  mvp: number;
  by_pack: Record<string, number>;
  by_archetype: Record<string, number>;
}

export function useContradictionRules() {
  return useQuery<{ rules: ContradictionRule[]; stats: RuleStats }>({
    queryKey: ['contradiction-rules'],
    queryFn: async () => {
      const res = await apiClient.get('/api/contradiction-rules');
      return res.data.data;
    },
  });
}

export function useUpdateContradictionRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ruleId, updates }: { ruleId: string; updates: Record<string, unknown> }) => {
      const res = await apiClient.patch(`/api/contradiction-rules/${ruleId}`, updates);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contradiction-rules'] });
    },
  });
}
