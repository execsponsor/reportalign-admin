import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

export interface OrganizationDefaultsResponse {
  defaults: Record<string, unknown>;
  updated_at: string | null;
  updated_by: string | null;
  is_from_database: boolean;
}

export function useOrganizationDefaults() {
  return useQuery<OrganizationDefaultsResponse>({
    queryKey: ['organization-defaults'],
    queryFn: async () => {
      const { data } = await apiClient.get('/organization-defaults');
      return data;
    },
  });
}

export function useUpdateOrganizationDefaults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (defaults: Record<string, unknown>) => {
      const { data } = await apiClient.put('/organization-defaults', { defaults });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-defaults'] });
    },
  });
}
