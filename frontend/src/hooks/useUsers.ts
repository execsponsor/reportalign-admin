import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';
import type { Pagination } from './useOrganizations';

export interface UserListItem {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  locked_until: string | null;
  failed_login_attempts: number;
  organizations: Array<{
    org_name: string;
    access_level: string;
    role: string;
  }> | null;
}

export interface UserDetail {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  email_verified: boolean;
  last_login: string | null;
  created_at: string;
  locked_until: string | null;
  failed_login_attempts: number;
  organizations: Array<{
    id: string;
    name: string;
    subdomain: string;
    access_level: string;
    role: string;
    is_active: boolean;
    created_at: string;
  }>;
  programmes: Array<{
    name: string;
    programme_role: string;
    programme_id: string;
  }>;
}

interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export function useUsers(params: ListParams = {}) {
  return useQuery<{ users: UserListItem[]; pagination: Pagination }>({
    queryKey: ['users', params],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.search) query.set('search', params.search);
      const { data } = await apiClient.get(`/users?${query}`);
      return data;
    },
  });
}

export function useUser(id: string | undefined) {
  return useQuery<UserDetail>({
    queryKey: ['user', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/users/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      email: string;
      firstName: string;
      lastName: string;
      organizationId: string;
      accessLevel: string;
    }) => {
      const { data } = await apiClient.post('/users', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
    },
  });
}

export function useUnlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/users/${id}/unlock`);
      return data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['user', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/users/${id}/reset-password`);
      return data;
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/users/${id}/deactivate`);
      return data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['user', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
    },
  });
}

export function useReactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/users/${id}/reactivate`);
      return data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['user', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
    },
  });
}
