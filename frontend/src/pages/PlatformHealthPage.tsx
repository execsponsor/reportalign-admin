import { Heart, Database, Server, Activity, Loader2, RefreshCw } from 'lucide-react';
import { usePlatformHealth } from '../hooks/usePlatformHealth';

export function PlatformHealthPage() {
  const { data, isLoading, refetch } = usePlatformHealth();

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
            <Heart className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Platform Health</h1>
            <p className="text-sm text-admin-muted">System status, database metrics, and resource usage</p>
          </div>
        </div>
        <button onClick={() => refetch()} className="p-2 rounded-lg text-admin-muted hover:text-white hover:bg-admin-card transition-colors">
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-admin-muted">
          <Loader2 className="h-6 w-6 animate-spin mr-3" />Loading...
        </div>
      )}

      {data && (
        <>
          {/* Status banner */}
          <div className={`rounded-xl p-4 mb-6 border ${data.database.status === 'healthy' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${data.database.status === 'healthy' ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className={`text-sm font-semibold ${data.database.status === 'healthy' ? 'text-green-400' : 'text-red-400'}`}>
                Database {data.database.status === 'healthy' ? 'Healthy' : 'Unhealthy'}
              </span>
              <span className="text-xs text-admin-muted">Latency: {data.database.latency_ms}ms</span>
              <span className="text-xs text-admin-muted">Server time: {new Date(data.database.server_time).toLocaleString()}</span>
            </div>
          </div>

          {/* Platform counts */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
            <StatCard label="Active Orgs" value={data.platform.active_orgs} total={data.platform.total_orgs} icon={<Database className="h-4 w-4" />} />
            <StatCard label="Active Users" value={data.platform.active_users} total={data.platform.total_users} icon={<Activity className="h-4 w-4" />} />
            <StatCard label="Programmes" value={data.platform.active_programmes} icon={<Server className="h-4 w-4" />} />
            <StatCard label="Total Reports" value={data.platform.total_reports} icon={<Activity className="h-4 w-4" />} />
            <StatCard label="Logins (24h)" value={data.platform.logins_24h} />
            <StatCard label="Reports (24h)" value={data.platform.reports_24h} />
          </div>

          {/* 24h activity row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <p className="text-xs text-admin-muted uppercase tracking-wider">Security Events (24h)</p>
              <p className="text-2xl font-bold text-yellow-400 mt-1">{data.platform.security_events_24h}</p>
            </div>
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <p className="text-xs text-admin-muted uppercase tracking-wider">AI Requests (24h)</p>
              <p className="text-2xl font-bold text-purple-400 mt-1">{data.platform.ai_requests_24h}</p>
            </div>
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <p className="text-xs text-admin-muted uppercase tracking-wider">DB Size</p>
              <p className="text-2xl font-bold text-white mt-1">{data.database.size}</p>
            </div>
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <p className="text-xs text-admin-muted uppercase tracking-wider">Process Uptime</p>
              <p className="text-2xl font-bold text-white mt-1">{formatUptime(data.process.uptime_seconds)}</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Database connections */}
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Database className="h-4 w-4 text-admin-accent" />Database Connections
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-admin-muted">Total</p>
                  <p className="text-xl font-bold text-white">{data.database.connections.total}</p>
                </div>
                <div>
                  <p className="text-xs text-admin-muted">Active</p>
                  <p className="text-xl font-bold text-green-400">{data.database.connections.active}</p>
                </div>
                <div>
                  <p className="text-xs text-admin-muted">Idle</p>
                  <p className="text-xl font-bold text-admin-text">{data.database.connections.idle}</p>
                </div>
                <div>
                  <p className="text-xs text-admin-muted">Idle in Transaction</p>
                  <p className="text-xl font-bold text-yellow-400">{data.database.connections.idle_in_transaction}</p>
                </div>
              </div>
              <div className="border-t border-admin-border mt-4 pt-4">
                <p className="text-xs text-admin-muted mb-2">Connection Pool (Admin API)</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-admin-muted">Total</p>
                    <p className="text-lg font-bold text-white">{data.database.pool.totalCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-admin-muted">Idle</p>
                    <p className="text-lg font-bold text-white">{data.database.pool.idleCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-admin-muted">Waiting</p>
                    <p className="text-lg font-bold text-white">{data.database.pool.waitingCount}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Process memory */}
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Server className="h-4 w-4 text-admin-accent" />Process Info
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-admin-muted">Node.js Version</p>
                  <p className="text-sm text-white font-mono">{data.process.node_version}</p>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-admin-muted">Heap Used</span>
                    <span className="text-white">{data.process.memory.heap_used_mb} MB / {data.process.memory.heap_total_mb} MB</span>
                  </div>
                  <div className="h-2 bg-admin-card rounded-full overflow-hidden">
                    <div className="h-full bg-admin-accent rounded-full"
                      style={{ width: `${(data.process.memory.heap_used_mb / data.process.memory.heap_total_mb) * 100}%` }} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-admin-muted">RSS Memory</p>
                  <p className="text-xl font-bold text-white">{data.process.memory.rss_mb} MB</p>
                </div>
              </div>
            </div>
          </div>

          {/* Table sizes */}
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Largest Tables</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-admin-border text-left text-admin-muted text-xs uppercase tracking-wider">
                  <th className="pb-3">Table</th>
                  <th className="pb-3 text-right">Rows</th>
                  <th className="pb-3 text-right">Size</th>
                </tr>
              </thead>
              <tbody>
                {data.table_sizes.map((t) => (
                  <tr key={t.table_name} className="border-b border-admin-border/30">
                    <td className="py-2 text-admin-text font-mono text-xs">{t.table_name}</td>
                    <td className="py-2 text-admin-muted text-right">{parseInt(t.row_count).toLocaleString()}</td>
                    <td className="py-2 text-admin-text text-right">{t.total_size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, total, icon }: { label: string; value: string; total?: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-admin-surface border border-admin-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-admin-accent">{icon}</span>}
        <p className="text-xs text-admin-muted">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">
        {parseInt(value).toLocaleString()}
        {total && <span className="text-sm text-admin-muted font-normal"> / {parseInt(total).toLocaleString()}</span>}
      </p>
    </div>
  );
}
