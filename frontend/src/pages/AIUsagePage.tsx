import { useState } from 'react';
import { Brain, Loader2 } from 'lucide-react';
import { useAIUsageSummary } from '../hooks/useAIUsage';

export function AIUsagePage() {
  const [period, setPeriod] = useState('current_month');
  const { data, isLoading } = useAIUsageSummary(period);

  const periodLabels: Record<string, string> = {
    current_month: 'Current Month',
    last_month: 'Last Month',
    last_3_months: 'Last 3 Months',
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Brain className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Usage & Costs</h1>
            <p className="text-sm text-admin-muted">Platform-wide AI consumption across all organisations</p>
          </div>
        </div>
        <div className="flex gap-1 bg-admin-surface border border-admin-border rounded-lg p-1">
          {Object.entries(periodLabels).map(([key, label]) => (
            <button key={key} onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${period === key ? 'bg-admin-accent text-white' : 'text-admin-muted hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-admin-muted">
          <Loader2 className="h-6 w-6 animate-spin mr-3" />Loading...
        </div>
      )}

      {data && (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <p className="text-xs text-admin-muted uppercase tracking-wider">Total Requests</p>
              <p className="text-3xl font-bold text-white mt-1">{data.totals.total_requests.toLocaleString()}</p>
            </div>
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <p className="text-xs text-admin-muted uppercase tracking-wider">Total Tokens</p>
              <p className="text-3xl font-bold text-white mt-1">{(data.totals.total_tokens / 1000).toFixed(1)}K</p>
            </div>
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <p className="text-xs text-admin-muted uppercase tracking-wider">Total Cost</p>
              <p className="text-3xl font-bold text-green-400 mt-1">${data.totals.total_cost_usd.toFixed(2)}</p>
            </div>
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <p className="text-xs text-admin-muted uppercase tracking-wider">Avg Latency</p>
              <p className="text-3xl font-bold text-white mt-1">{data.totals.avg_latency_ms}ms</p>
            </div>
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <p className="text-xs text-admin-muted uppercase tracking-wider">BYOAI vs Default</p>
              <p className="text-lg font-bold text-white mt-1">
                <span className="text-admin-accent">{data.provider_split.byoai}</span>
                <span className="text-admin-muted mx-1">/</span>
                <span>{data.provider_split.platform_default}</span>
              </p>
              <p className="text-xs text-admin-muted">BYOAI / Platform</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* By Organisation */}
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Usage by Organisation</h3>
              <div className="space-y-3">
                {data.by_org.length === 0 && <p className="text-sm text-admin-muted">No usage data</p>}
                {data.by_org.map((org) => (
                  <div key={org.subdomain} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">{org.org_name}</p>
                      <p className="text-xs text-admin-muted">{org.subdomain}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white">${parseFloat(org.cost_usd).toFixed(2)}</p>
                      <p className="text-xs text-admin-muted">{parseInt(org.requests).toLocaleString()} reqs</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Operation */}
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Usage by Operation</h3>
              <div className="space-y-3">
                {data.by_operation.length === 0 && <p className="text-sm text-admin-muted">No usage data</p>}
                {data.by_operation.map((op) => {
                  const maxRequests = Math.max(...data.by_operation.map((o) => parseInt(o.requests)));
                  const pct = maxRequests > 0 ? (parseInt(op.requests) / maxRequests) * 100 : 0;
                  return (
                    <div key={op.operation}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-admin-text">{op.operation}</span>
                        <span className="text-admin-muted">{parseInt(op.requests).toLocaleString()} reqs / ${parseFloat(op.cost_usd).toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 bg-admin-card rounded-full overflow-hidden">
                        <div className="h-full bg-admin-accent rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* By Provider */}
          {data.by_provider.length > 0 && (
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5 mb-6">
              <h3 className="text-sm font-semibold text-white mb-4">Usage by Provider</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {data.by_provider.map((p) => (
                  <div key={p.provider} className="bg-admin-card border border-admin-border rounded-lg p-4">
                    <p className="text-xs text-admin-muted">{p.provider}</p>
                    <p className="text-lg font-bold text-white">{parseInt(p.requests).toLocaleString()}</p>
                    <p className="text-xs text-green-400">${parseFloat(p.cost_usd).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily chart (simple bar representation) */}
          {data.daily_usage.length > 0 && (
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Daily Requests (30 days)</h3>
              <div className="flex items-end gap-1 h-32">
                {data.daily_usage.map((day) => {
                  const maxReqs = Math.max(...data.daily_usage.map((d) => parseInt(d.requests)));
                  const height = maxReqs > 0 ? (parseInt(day.requests) / maxReqs) * 100 : 0;
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center justify-end group relative">
                      <div className="w-full bg-admin-accent/80 rounded-t-sm min-h-[2px] transition-colors hover:bg-admin-accent"
                        style={{ height: `${height}%` }} />
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-admin-bg border border-admin-border rounded-lg px-2 py-1 text-xs text-white whitespace-nowrap z-10">
                        {new Date(day.date).toLocaleDateString()}: {day.requests} reqs / ${parseFloat(day.cost_usd).toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-admin-muted mt-2">
                <span>{data.daily_usage.length > 0 && new Date(data.daily_usage[0].date).toLocaleDateString()}</span>
                <span>{data.daily_usage.length > 0 && new Date(data.daily_usage[data.daily_usage.length - 1].date).toLocaleDateString()}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
