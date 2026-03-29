import { Link } from 'react-router-dom';
import { Building2, Users, FolderKanban, FileText, TrendingUp, Shield, ArrowUpRight, Loader2 } from 'lucide-react';
import { usePlatformStats } from '../hooks/usePlatformStats';

export function DashboardPage() {
  const { data: stats, isLoading, error } = usePlatformStats();

  const statCards = [
    {
      label: 'Organizations',
      value: stats?.organizations.total ?? '—',
      sub: stats ? `${stats.organizations.active} active` : '',
      icon: Building2,
      color: 'text-admin-accent',
      link: '/organizations',
    },
    {
      label: 'Active Users',
      value: stats?.users.active ?? '—',
      sub: stats ? `${stats.users.total} total` : '',
      icon: Users,
      color: 'text-admin-success',
      link: '/users',
    },
    {
      label: 'Programmes',
      value: stats?.programmes.total ?? '—',
      sub: '',
      icon: FolderKanban,
      color: 'text-purple-400',
    },
    {
      label: 'Reports',
      value: stats?.reports.total ?? '—',
      sub: '',
      icon: FileText,
      color: 'text-sky-400',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Shield className="h-8 w-8 text-admin-accent" />
          Super Admin Dashboard
        </h1>
        <p className="text-admin-muted mt-2">Platform overview and management controls</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          Failed to load platform stats. {(error as Error).message}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const content = (
            <div className="bg-admin-surface border border-admin-border rounded-xl p-6 hover:border-admin-accent/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-admin-muted text-sm">{stat.label}</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-admin-muted" /> : stat.value}
                  </p>
                  {stat.sub && <p className="text-xs text-admin-muted mt-1">{stat.sub}</p>}
                </div>
                <div className="w-12 h-12 rounded-lg bg-admin-card flex items-center justify-center">
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
          return stat.link ? (
            <Link key={stat.label} to={stat.link}>{content}</Link>
          ) : (
            <div key={stat.label}>{content}</div>
          );
        })}
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Subscription Breakdown */}
        <div className="bg-admin-surface border border-admin-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-admin-accent" />
            Subscription Tiers
          </h2>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-admin-muted" />
          ) : stats?.subscriptions.length ? (
            <div className="space-y-3">
              {stats.subscriptions.map((s) => (
                <div key={s.subscription_tier} className="flex justify-between items-center">
                  <span className="text-admin-text text-sm capitalize">
                    {s.subscription_tier.replace('_', ' ')}
                  </span>
                  <span className="text-white font-semibold">{s.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-admin-muted text-sm">No data</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-admin-surface border border-admin-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity (30 days)</h2>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-admin-muted" />
          ) : stats ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-admin-text text-sm">New Organizations</span>
                <span className="text-white font-semibold">{stats.recentActivity.newOrgs30d}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-admin-text text-sm">New Users</span>
                <span className="text-white font-semibold">{stats.recentActivity.newUsers30d}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-admin-text text-sm">Locked Accounts</span>
                <span className="text-yellow-400 font-semibold">{stats.users.locked}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-admin-text text-sm">Suspended Orgs</span>
                <span className="text-red-400 font-semibold">{stats.organizations.suspended}</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Quick Links */}
        <div className="bg-admin-surface border border-admin-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link to="/organizations" className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-admin-card text-admin-text text-sm transition-colors">
              <span>Manage Organizations</span>
              <ArrowUpRight className="h-4 w-4 text-admin-muted" />
            </Link>
            <Link to="/users" className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-admin-card text-admin-text text-sm transition-colors">
              <span>Manage Users</span>
              <ArrowUpRight className="h-4 w-4 text-admin-muted" />
            </Link>
            <Link to="/audit-log" className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-admin-card text-admin-text text-sm transition-colors">
              <span>View Audit Log</span>
              <ArrowUpRight className="h-4 w-4 text-admin-muted" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
