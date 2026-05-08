import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

export interface NpsPlatformStats {
  totalResponses: number;
  avgScore: number;
  npsScore: number;
  promoters: number;
  passives: number;
  detractors: number;
}

export interface NpsOrgRow {
  orgId: string;
  orgName: string;
  subdomain: string;
  responseCount: number;
  avgScore: number;
  npsScore: number;
  promoters: number;
  passives: number;
  detractors: number;
  latestResponse: string;
}

export interface NpsTrendPoint {
  month: string;
  responseCount: number;
  avgScore: number;
  npsScore: number;
}

export interface NpsFeedbackItem {
  score: number;
  feedbackText: string;
  role: string | null;
  createdAt: string;
  orgName: string;
  firstName: string;
  lastName: string;
}

export interface NpsSurveySummary {
  platform: NpsPlatformStats;
  byOrg: NpsOrgRow[];
  trend: NpsTrendPoint[];
  latestFeedback: NpsFeedbackItem[];
}

export function useNpsSurveys() {
  return useQuery<NpsSurveySummary>({
    queryKey: ['nps-surveys'],
    queryFn: async () => {
      const { data } = await apiClient.get('/nps-surveys');
      return data;
    },
  });
}

export interface NpsOrgDetail {
  organization: { id: string; name: string; subdomain: string };
  stats: NpsPlatformStats;
  trend: NpsTrendPoint[];
  responses: Array<{
    id: string;
    score: number;
    feedbackText: string | null;
    role: string | null;
    createdAt: string;
    firstName: string;
    lastName: string;
    email: string;
  }>;
}

export function useNpsOrgDetail(orgId: string | null) {
  return useQuery<NpsOrgDetail>({
    queryKey: ['nps-surveys', orgId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/nps-surveys/${orgId}`);
      return data;
    },
    enabled: !!orgId,
  });
}
