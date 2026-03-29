import { useState } from 'react';
import { ScrollText, Search, Download } from 'lucide-react';

export function AuditLogPage() {
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-admin-muted text-sm mt-1">All super admin actions with full audit trail</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-admin-card hover:bg-admin-border text-admin-text rounded-lg font-medium text-sm transition-colors border border-admin-border">
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-admin-muted" />
          <input
            type="text"
            placeholder="Filter by admin email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-admin-surface border border-admin-border rounded-lg text-admin-text text-sm placeholder:text-admin-muted focus:outline-none focus:ring-2 focus:ring-admin-accent/50 focus:border-admin-accent"
          />
        </div>
        <select className="px-4 py-2.5 bg-admin-surface border border-admin-border rounded-lg text-admin-text text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent/50">
          <option value="">All Action Types</option>
          <option value="CREATE_ORGANIZATION">Create Organization</option>
          <option value="UPDATE_ORGANIZATION">Update Organization</option>
          <option value="CREATE_USER">Create User</option>
          <option value="RESET_PASSWORD">Reset Password</option>
          <option value="DEACTIVATE_USER">Deactivate User</option>
          <option value="UNLOCK_ACCOUNT">Unlock Account</option>
        </select>
        <input
          type="date"
          className="px-4 py-2.5 bg-admin-surface border border-admin-border rounded-lg text-admin-text text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
        />
      </div>

      <div className="bg-admin-surface border border-admin-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-admin-border">
              <th className="text-left px-6 py-4 text-xs font-semibold text-admin-muted uppercase tracking-wider">Timestamp</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-admin-muted uppercase tracking-wider">Admin</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-admin-muted uppercase tracking-wider">Action</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-admin-muted uppercase tracking-wider">Target</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-admin-muted uppercase tracking-wider">Reason</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="px-6 py-12 text-center text-admin-muted">
                <ScrollText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Connect to the API to load audit entries</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
