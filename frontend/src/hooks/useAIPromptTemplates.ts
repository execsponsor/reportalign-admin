import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

export interface AIPromptTemplate {
  id: string;
  template_key: string;
  display_name: string;
  description: string | null;
  system_prompt: string;
  user_prompt_template: string | null;
  is_active: boolean;
  tone: string | null;
  target_audience: string | null;
  max_output_tokens: number;
  temperature: number;
  example_input: string | null;
  example_output: string | null;
  created_at: string;
  updated_at: string;
  override_count: number;
}

export interface TemplateOverride {
  id: string;
  organization_id: string;
  organization_name: string;
  subdomain: string;
  system_prompt: string;
  tone: string | null;
  target_audience: string | null;
  temperature: number;
  max_output_tokens: number;
  updated_at: string;
}

export interface TemplateDetail {
  template: AIPromptTemplate;
  overrides: TemplateOverride[];
}

export function useAIPromptTemplates() {
  return useQuery<{ templates: AIPromptTemplate[] }>({
    queryKey: ['ai-prompt-templates'],
    queryFn: async () => {
      const { data } = await apiClient.get('/ai-prompt-templates');
      return data;
    },
  });
}

export function useAIPromptTemplate(templateKey: string | null) {
  return useQuery<TemplateDetail>({
    queryKey: ['ai-prompt-template', templateKey],
    queryFn: async () => {
      const { data } = await apiClient.get(`/ai-prompt-templates/${templateKey}`);
      return data;
    },
    enabled: !!templateKey,
  });
}

export function useUpdateAIPromptTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateKey, updates }: { templateKey: string; updates: Record<string, unknown> }) => {
      const { data } = await apiClient.put(`/ai-prompt-templates/${templateKey}`, updates);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-prompt-templates'] });
      queryClient.invalidateQueries({ queryKey: ['ai-prompt-template', variables.templateKey] });
    },
  });
}
