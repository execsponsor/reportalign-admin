import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

export interface ReportCompliance {
  totals: {
    total_reports: string; approved: string; submitted: string; draft: string;
    rejected: string; last_30d: string; last_7d: string;
  };
  by_org: Array<{
    org_name: string; subdomain: string; total_reports: string;
    approved: string; draft: string; last_30d: string;
  }>;
  monthly_volume: Array<{ month: string; total: string; approved: string }>;
  cycle_time: { avg_hours: number | null; median_hours: number | null };
  stale_programmes: Array<{
    id: string; programme_name: string; org_name: string; subdomain: string;
    last_report_date: string | null;
  }>;
}

export function useReportCompliance() {
  return useQuery<ReportCompliance>({
    queryKey: ['report-compliance'],
    queryFn: async () => {
      const { data } = await apiClient.get('/report-compliance');
      return data;
    },
  });
}
