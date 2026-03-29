import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

export interface Organization {
  id: string;
  name: string;
  subdomain: string;
  organization_type: string;
  is_active: boolean;
  subscription_tier: string;
  subscription_status: string;
  max_users: number;
  max_programmes: number;
  is_beta_customer: boolean;
  created_at: string;
  user_count: string;
  programme_count: string;
}

export interface OrganizationDetail extends Organization {
  updated_at: string;
  primary_brand_color: string;
  admin_info: {
    email: string;
    first_name: string;
    last_name: string;
    last_login: string;
  } | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  tier?: string;
}

export function useOrganizations(params: ListParams = {}) {
  return useQuery<{ organizations: Organization[]; pagination: Pagination }>({
    queryKey: ['organizations', params],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.search) query.set('search', params.search);
      if (params.status) query.set('status', params.status);
      if (params.tier) query.set('tier', params.tier);
      const { data } = await apiClient.get(`/organizations?${query}`);
      return data;
    },
  });
}

export function useOrganization(id: string | undefined) {
  return useQuery<OrganizationDetail>({
    queryKey: ['organization', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/organizations/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      subdomain: string;
      organizationType: string;
      adminEmail: string;
      subscriptionTier: string;
    }) => {
      const { data } = await apiClient.post('/organizations', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; [key: string]: unknown }) => {
      const { data } = await apiClient.patch(`/organizations/${id}`, body);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
    },
  });
}
