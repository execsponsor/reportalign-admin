import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus, Search, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { useOrganizations } from '../hooks/useOrganizations';

const statusColors: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  trialing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  suspended: 'bg-red-500/10 text-red-400 border-red-500/20',
  cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  past_due: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  expired: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const tierColors: Record<string, string> = {
  standard: 'text-gray-300',
  pro: 'text-admin-accent',
  max: 'text-purple-400',
  beta_customer: 'text-yellow-400',
};

export function OrganizationsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [tier, setTier] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useOrganizations({
    page,
    search: search || undefined,
    status: status || undefined,
    tier: tier || undefined,
  });

  const orgs = data?.organizations ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Organizations</h1>
          <p className="text-admin-muted text-sm mt-1">
            {pagination ? `${pagination.total} total organizations` : 'Manage all ExecSponsor organizations'}
          </p>
        </div>
        <button
          onClick={() => alert('Create Organization form coming soon')}
          className="flex items-center gap-2 px-4 py-2.5 bg-admin-accent hover:bg-admin-accent-hover text-white rounded-lg font-medium text-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Organization
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-admin-muted" />
          <input
            type="text"
            placeholder="Search by name or subdomain..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-admin-surface border border-admin-border rounded-lg text-admin-text text-sm placeholder:text-admin-muted focus:outline-none focus:ring-2 focus:ring-admin-accent/50 focus:border-admin-accent"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-4 py-2.5 bg-admin-surface border border-admin-border rounded-lg text-admin-text text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="trialing">Trial</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={tier}
          onChange={(e) => { setTier(e.target.value); setPage(1); }}
          className="px-4 py-2.5 bg-admin-surface border border-admin-border rounded-lg text-admin-text text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
        >
          <option value="">All Tiers</option>
          <option value="standard">Standard</option>
          <option value="pro">Pro</option>
          <option value="max">Max</option>
          <option value="beta_customer">Beta</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          Failed to load organizations. {(error as Error).message}
        </div>
      )}

      {/* Table */}
      <div className="bg-admin-surface border border-admin-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-admin-border">
              <th className="text-left px-6 py-4 text-xs font-semibold text-admin-muted uppercase tracking-wider">Organization</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-admin-muted uppercase tracking-wider">Subdomain</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-admin-muted uppercase tracking-wider">Tier</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-admin-muted uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-admin-muted uppercase tracking-wider">Users</th>
              <th className="text-right px-6 py-4 text-xs font-semibold text-admin-muted uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-admin-accent mx-auto" />
                </td>
              </tr>
            ) : orgs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-admin-muted">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No organizations found</p>
                </td>
              </tr>
            ) : (
              orgs.map((org) => (
                <tr key={org.id} className="hover:bg-admin-card/50 transition-colors">
                  <td className="px-6 py-4">
                    <Link to={`/organizations/${org.id}`} className="text-white font-medium hover:text-admin-accent transition-colors">
                      {org.name}
                    </Link>
                    <p className="text-xs text-admin-muted mt-0.5 capitalize">{org.organization_type.replace('_', ' ')}</p>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-sm text-admin-muted font-mono">{org.subdomain}</code>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-medium capitalize ${tierColors[org.subscription_tier] || 'text-gray-300'}`}>
                      {org.subscription_tier.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[org.subscription_status] || statusColors.active}`}>
                      {org.subscription_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-admin-text text-sm">
                    {org.user_count} / {org.max_users}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link to={`/organizations/${org.id}`} className="text-admin-muted hover:text-admin-accent transition-colors">
                      <ChevronRight className="h-5 w-5" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-admin-muted">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-2 rounded-lg bg-admin-surface border border-admin-border text-admin-text text-sm hover:bg-admin-card disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pagination.totalPages}
              className="px-3 py-2 rounded-lg bg-admin-surface border border-admin-border text-admin-text text-sm hover:bg-admin-card disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
