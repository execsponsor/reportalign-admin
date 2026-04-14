import { useState } from 'react';
import { ShieldAlert, Search, ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { useSecurityEvents, useSecuritySummary } from '../hooks/useSecurityEvents';

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const typeLabels: Record<string, string> = {
  'auth.failed_login': 'Failed Login',
  'auth.account_locked': 'Account Locked',
  'auth.invalid_token': 'Invalid Token',
  'auth.token_expired': 'Token Expired',
  'rate_limit.exceeded': 'Rate Limited',
  'access.unauthorized': 'Unauthorized',
  'suspicious.credential_stuffing': 'Credential Stuffing',
  'suspicious.brute_force': 'Brute Force',
};

export function SecurityEventsPage() {
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState('');
  const [eventType, setEventType] = useState('');
  const [email, setEmail] = useState('');
  const [ip, setIp] = useState('');

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useSecuritySummary();
  const { data, isLoading } = useSecurityEvents({
    page, limit: 50,
    severity: severity || undefined,
    eventType: eventType || undefined,
    email: email || undefined,
    ip: ip || undefined,
  });

  const events = data?.events ?? [];
  const pagination = data?.pagination;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
            <ShieldAlert className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Security Events</h1>
            <p className="text-sm text-admin-muted">Authentication failures, lockouts, and suspicious activity</p>
          </div>
        </div>
        <button onClick={() => refetchSummary()} className="p-2 rounded-lg text-admin-muted hover:text-white hover:bg-admin-card transition-colors">
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* Summary cards */}
      {!summaryLoading && summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <p className="text-xs text-admin-muted uppercase tracking-wider">Failed Logins (24h)</p>
            <p className="text-3xl font-bold text-red-400 mt-1">{summary.failed_logins_24h}</p>
          </div>
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <p className="text-xs text-admin-muted uppercase tracking-wider">Lockouts (24h)</p>
            <p className="text-3xl font-bold text-orange-400 mt-1">{summary.lockouts_24h}</p>
          </div>
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <p className="text-xs text-admin-muted uppercase tracking-wider">Events (7d)</p>
            <p className="text-3xl font-bold text-admin-text mt-1">
              {summary.by_severity_7d.reduce((sum, s) => sum + parseInt(s.count), 0)}
            </p>
          </div>
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <p className="text-xs text-admin-muted uppercase tracking-wider">Unique IPs (24h)</p>
            <p className="text-3xl font-bold text-admin-text mt-1">{summary.top_ips_24h.length}</p>
          </div>
        </div>
      )}

      {/* Top offenders row */}
      {!summaryLoading && summary && (summary.top_ips_24h.length > 0 || summary.top_emails_24h.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          {summary.top_ips_24h.length > 0 && (
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Top IPs (24h)</h3>
              <div className="space-y-2">
                {summary.top_ips_24h.slice(0, 5).map((item) => (
                  <div key={item.ip_address} className="flex justify-between text-sm">
                    <button onClick={() => { setIp(item.ip_address); setPage(1); }} className="text-admin-accent hover:underline font-mono text-xs">{item.ip_address}</button>
                    <span className="text-red-400 font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {summary.top_emails_24h.length > 0 && (
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Top Targeted Emails (24h)</h3>
              <div className="space-y-2">
                {summary.top_emails_24h.slice(0, 5).map((item) => (
                  <div key={item.email} className="flex justify-between text-sm">
                    <button onClick={() => { setEmail(item.email); setPage(1); }} className="text-admin-accent hover:underline text-xs">{item.email}</button>
                    <span className="text-red-400 font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-admin-surface border border-admin-border rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
            className="bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text">
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={eventType} onChange={(e) => { setEventType(e.target.value); setPage(1); }}
            className="bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text">
            <option value="">All Types</option>
            {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-admin-muted" />
            <input value={email} onChange={(e) => { setEmail(e.target.value); setPage(1); }}
              placeholder="Filter by email" className="w-full bg-admin-bg border border-admin-border rounded-lg pl-9 pr-3 py-2 text-sm text-admin-text" />
          </div>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-admin-muted" />
            <input value={ip} onChange={(e) => { setIp(e.target.value); setPage(1); }}
              placeholder="Filter by IP" className="w-full bg-admin-bg border border-admin-border rounded-lg pl-9 pr-3 py-2 text-sm text-admin-text" />
          </div>
          {(severity || eventType || email || ip) && (
            <button onClick={() => { setSeverity(''); setEventType(''); setEmail(''); setIp(''); setPage(1); }}
              className="text-sm text-admin-accent hover:text-admin-accent-hover">Clear filters</button>
          )}
        </div>
      </div>

      {/* Events table */}
      <div className="bg-admin-surface border border-admin-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-admin-muted">
            <Loader2 className="h-6 w-6 animate-spin mr-3" />Loading...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-border text-left text-admin-muted text-xs uppercase tracking-wider">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-admin-border/50 hover:bg-admin-card/50">
                  <td className="px-4 py-3 text-admin-muted text-xs whitespace-nowrap">
                    {new Date(event.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${severityColors[event.severity] || 'text-admin-muted'}`}>
                      {event.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-admin-text text-xs">
                    {typeLabels[event.event_type] || event.event_type}
                  </td>
                  <td className="px-4 py-3 text-admin-text text-xs">{event.email || '---'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-admin-muted">{event.ip_address || '---'}</td>
                  <td className="px-4 py-3 text-admin-muted text-xs max-w-xs truncate">{event.reason || '---'}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-admin-muted">No security events found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-admin-muted">
          <span>Page {pagination.page} of {pagination.totalPages} ({pagination.total} events)</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="p-2 rounded-lg hover:bg-admin-card disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
              className="p-2 rounded-lg hover:bg-admin-card disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
