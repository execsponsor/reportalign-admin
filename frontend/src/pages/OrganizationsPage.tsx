import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus, Search, ChevronRight } from 'lucide-react';

export function OrganizationsPage() {
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Organizations</h1>
          <p className="text-admin-muted text-sm mt-1">Manage all ExecSponsor organizations</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-admin-accent hover:bg-admin-accent-hover text-white rounded-lg font-medium text-sm transition-colors">
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
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-admin-surface border border-admin-border rounded-lg text-admin-text text-sm placeholder:text-admin-muted focus:outline-none focus:ring-2 focus:ring-admin-accent/50 focus:border-admin-accent"
          />
        </div>
        <select className="px-4 py-2.5 bg-admin-surface border border-admin-border rounded-lg text-admin-text text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent/50">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="trialing">Trial</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="px-4 py-2.5 bg-admin-surface border border-admin-border rounded-lg text-admin-text text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent/50">
          <option value="">All Tiers</option>
          <option value="standard">Standard</option>
          <option value="pro">Pro</option>
          <option value="max">Max</option>
          <option value="beta_customer">Beta</option>
        </select>
      </div>

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
          <tbody>
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-admin-muted">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Connect to the API to load organizations</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
