import { useState } from 'react';
import { ScrollText, Search, Download, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useAuditLog } from '../hooks/useAuditLog';
import apiClient from '../lib/api-client';

const actionLabels: Record<string, string> = {
  CREATE_ORGANIZATION: 'Create Organization',
  UPDATE_ORGANIZATION: 'Update Organization',
  CREATE_USER: 'Create User',
  RESET_PASSWORD: 'Reset Password',
  DEACTIVATE_USER: 'Deactivate User',
  REACTIVATE_USER: 'Reactivate User',
  UNLOCK_ACCOUNT: 'Unlock Account',
};

const actionColors: Record<string, string> = {
  CREATE_ORGANIZATION: 'text-green-400',
  UPDATE_ORGANIZATION: 'text-blue-400',
  CREATE_USER: 'text-green-400',
  RESET_PASSWORD: 'text-yellow-400',
  DEACTIVATE_USER: 'text-red-400',
  REACTIVATE_USER: 'text-green-400',
  UNLOCK_ACCOUNT: 'text-yellow-400',
};

export function AuditLogPage() {
  const [adminEmail, setAdminEmail] = useState('');
  const [actionType, setActionType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useAuditLog({
    page,
    limit: 50,
    adminEmail: adminEmail || undefined,
    actionType: actionType || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  });

  const entries = data?.entries ?? [];
  const pagination = data?.pagination;

  const handleExportCsv = async () => {
    try {
      const { data: allData } = await apiClient.get('/audit-log?limit=1000');
      const rows = (allData.entries || allData).map((e: Record<string, unknown>) =>
        [e.created_at, e.admin_email, e.action_type, e.target_type, e.target_id, e.reason || ''].join(',')
      );
      const csv = ['Timestamp,Admin,Action,Target Type,Target ID,Reason', ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silently fail - user will see no download
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-admin-muted text-sm mt-1">
            {pagination ? `${pagination.total} total entries` : 'All super admin actions with full audit trail'}
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-4 py-2.5 bg-admin-card hover:bg-admin-border text-admin-text rounded-lg font-medium text-sm transition-colors border border-admin-border"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-admin-muted" />
          <input
            type="text"
            placeholder="Filter by admin email..."
            value={adminEmail}
            onChange={(e) => { setAdminEmail(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-admin-surface border border-admin-border rounded-lg text-admin-text text-sm placeholder:text-admin-muted focus:outline-none focus:ring-2 focus:ring-admin-accent/50 focus:border-admin-accent"
          />
        </div>
        <select
          value={actionType}
          onChange={(e) => { setActionType(e.target.value); setPage(1); }}
          className="px-4 py-2.5 bg-admin-surface border border-admin-border rounded-lg text-admin-text text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
        >
          <option value="">All Action Types</option>
          {Object.entries(actionLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
          placeholder="From"
          className="px-4 py-2.5 bg-admin-surface border border-admin-border rounded-lg text-admin-text text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => { setToDate(e.target.value); setPage(1); }}
          placeholder="To"
          className="px-4 py-2.5 bg-admin-surface border border-admin-border rounded-lg text-admin-text text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          Failed to load audit log. {(error as Error).message}
        </div>
      )}

      {/* Table */}
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
          <tbody className="divide-y divide-admin-border">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-admin-accent mx-auto" />
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-admin-muted">
                  <ScrollText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No audit entries found</p>
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-admin-card/50 transition-colors">
                  <td className="px-6 py-4 text-admin-text text-sm whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-admin-text text-sm">{entry.admin_email}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-medium ${actionColors[entry.action_type] || 'text-admin-text'}`}>
                      {actionLabels[entry.action_type] || entry.action_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-admin-muted text-sm capitalize">{entry.target_type}</span>
                    {entry.target_id && (
                      <code className="block text-xs text-admin-muted/60 font-mono mt-0.5 truncate max-w-[200px]">
                        {entry.target_id}
                      </code>
                    )}
                  </td>
                  <td className="px-6 py-4 text-admin-muted text-sm max-w-[200px] truncate">
                    {entry.reason || '—'}
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
