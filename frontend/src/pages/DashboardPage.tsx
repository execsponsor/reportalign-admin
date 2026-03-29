import { Building2, Users, FolderKanban, FileText, TrendingUp, Shield } from 'lucide-react';

// Placeholder stats — will connect to API
const stats = [
  { label: 'Organizations', value: '—', icon: Building2, color: 'text-admin-accent' },
  { label: 'Active Users', value: '—', icon: Users, color: 'text-admin-success' },
  { label: 'Programmes', value: '—', icon: FolderKanban, color: 'text-purple-400' },
  { label: 'Reports', value: '—', icon: FileText, color: 'text-sky-400' },
];

export function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Shield className="h-8 w-8 text-admin-accent" />
          Super Admin Dashboard
        </h1>
        <p className="text-admin-muted mt-2">
          Platform overview and management controls
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-admin-surface border border-admin-border rounded-xl p-6 hover:border-admin-accent/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-admin-muted text-sm">{stat.label}</p>
                <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-admin-card flex items-center justify-center">
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-admin-surface border border-admin-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-admin-accent" />
            Subscription Overview
          </h2>
          <p className="text-admin-muted text-sm">Loading...</p>
        </div>

        <div className="bg-admin-surface border border-admin-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
          <p className="text-admin-muted text-sm">Loading...</p>
        </div>

        <div className="bg-admin-surface border border-admin-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">System Health</h2>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-admin-success animate-pulse" />
            <span className="text-admin-success text-sm font-medium">All Systems Operational</span>
          </div>
        </div>
      </div>
    </div>
  );
}
