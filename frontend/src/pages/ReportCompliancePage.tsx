import { FileBarChart, Loader2, AlertTriangle } from 'lucide-react';
import { useReportCompliance } from '../hooks/useReportCompliance';

export function ReportCompliancePage() {
  const { data, isLoading } = useReportCompliance();

  if (isLoading) return <div className="flex items-center justify-center py-20 text-admin-muted"><Loader2 className="h-6 w-6 animate-spin mr-3" />Loading...</div>;
  if (!data) return null;

  const t = data.totals;
  const approvalRate = parseInt(t.total_reports) > 0
    ? ((parseInt(t.approved) / parseInt(t.total_reports)) * 100).toFixed(1) : '0';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <FileBarChart className="h-5 w-5 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Report Compliance</h1>
          <p className="text-sm text-admin-muted">Submission rates, approval cycles, and stale programmes across all orgs</p>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-admin-surface border border-admin-border rounded-xl p-4">
          <p className="text-xs text-admin-muted">Total Reports</p>
          <p className="text-2xl font-bold text-white">{parseInt(t.total_reports).toLocaleString()}</p>
        </div>
        <div className="bg-admin-surface border border-admin-border rounded-xl p-4">
          <p className="text-xs text-admin-muted">Approved</p>
          <p className="text-2xl font-bold text-green-400">{parseInt(t.approved).toLocaleString()}</p>
        </div>
        <div className="bg-admin-surface border border-admin-border rounded-xl p-4">
          <p className="text-xs text-admin-muted">Approval Rate</p>
          <p className="text-2xl font-bold text-admin-accent">{approvalRate}%</p>
        </div>
        <div className="bg-admin-surface border border-admin-border rounded-xl p-4">
          <p className="text-xs text-admin-muted">Last 30 Days</p>
          <p className="text-2xl font-bold text-white">{parseInt(t.last_30d).toLocaleString()}</p>
        </div>
        <div className="bg-admin-surface border border-admin-border rounded-xl p-4">
          <p className="text-xs text-admin-muted">Avg Approval</p>
          <p className="text-2xl font-bold text-white">{data.cycle_time.avg_hours != null ? `${data.cycle_time.avg_hours}h` : '---'}</p>
        </div>
        <div className="bg-admin-surface border border-admin-border rounded-xl p-4">
          <p className="text-xs text-admin-muted">Median Approval</p>
          <p className="text-2xl font-bold text-white">{data.cycle_time.median_hours != null ? `${data.cycle_time.median_hours}h` : '---'}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly volume */}
        {data.monthly_volume.length > 0 && (
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Monthly Report Volume</h3>
            <div className="space-y-3">
              {data.monthly_volume.map((m) => {
                const total = parseInt(m.total);
                const approved = parseInt(m.approved);
                const maxTotal = Math.max(...data.monthly_volume.map((v) => parseInt(v.total)));
                const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
                return (
                  <div key={m.month}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-admin-text">{m.month}</span>
                      <span className="text-admin-muted">{total} total / {approved} approved</span>
                    </div>
                    <div className="h-2 bg-admin-card rounded-full overflow-hidden">
                      <div className="h-full bg-admin-accent rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* By org */}
        <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Reports by Organisation (Last 30d)</h3>
          <div className="space-y-3">
            {data.by_org.length === 0 && <p className="text-sm text-admin-muted">No report data</p>}
            {data.by_org.map((org) => (
              <div key={org.subdomain} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{org.org_name}</p>
                  <p className="text-xs text-admin-muted">{org.subdomain}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white">{org.last_30d} <span className="text-admin-muted text-xs">this month</span></p>
                  <p className="text-xs text-admin-muted">{org.total_reports} total / {org.approved} approved</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stale programmes */}
      {data.stale_programmes.length > 0 && (
        <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            Stale Programmes (No report in 60+ days)
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-border text-left text-admin-muted text-xs uppercase tracking-wider">
                <th className="pb-3">Programme</th>
                <th className="pb-3">Organisation</th>
                <th className="pb-3">Last Report</th>
              </tr>
            </thead>
            <tbody>
              {data.stale_programmes.map((p) => (
                <tr key={p.id} className="border-b border-admin-border/30">
                  <td className="py-2 text-admin-text">{p.programme_name}</td>
                  <td className="py-2 text-admin-muted">{p.org_name} ({p.subdomain})</td>
                  <td className="py-2 text-admin-muted">
                    {p.last_report_date ? new Date(p.last_report_date).toLocaleDateString() : <span className="text-red-400">Never</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
