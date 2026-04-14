import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

export interface Broadcast {
  id: string;
  title: string;
  message: string;
  link_url: string | null;
  link_text: string | null;
  broadcast_type: 'info' | 'warning' | 'critical';
  target_organization_ids: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  show_on_auth_pages: boolean;
  show_on_app: boolean;
  total_impressions: number;
  total_clicks: number;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceWindow {
  id: string;
  title: string;
  description: string | null;
  reason: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: string;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

export function useBroadcasts(status?: string) {
  return useQuery<{ broadcasts: Broadcast[] }>({
    queryKey: ['broadcasts', status],
    queryFn: async () => {
      const query = status ? `?status=${status}` : '';
      const { data } = await apiClient.get(`/broadcasts${query}`);
      return data;
    },
  });
}

export function useCreateBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post('/broadcasts', body);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['broadcasts'] }); },
  });
}

export function useUpdateBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; [key: string]: unknown }) => {
      const { data } = await apiClient.patch(`/broadcasts/${id}`, body);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['broadcasts'] }); },
  });
}

export function useMaintenanceWindows() {
  return useQuery<{ windows: MaintenanceWindow[] }>({
    queryKey: ['maintenance-windows'],
    queryFn: async () => {
      const { data } = await apiClient.get('/maintenance-windows');
      return data;
    },
  });
}

export function useCreateMaintenanceWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post('/maintenance-windows', body);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance-windows'] }); },
  });
}

export function useUpdateMaintenanceWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; [key: string]: unknown }) => {
      const { data } = await apiClient.patch(`/maintenance-windows/${id}`, body);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance-windows'] }); },
  });
}
