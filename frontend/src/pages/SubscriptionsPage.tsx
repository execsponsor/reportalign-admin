import { CreditCard, AlertTriangle, Loader2, Clock, Plus } from 'lucide-react';
import { useSubscriptionOverview } from '../hooks/useSubscriptions';
import { Link } from 'react-router-dom';

const tierColors: Record<string, string> = {
  free: 'text-admin-muted', starter: 'text-blue-400', standard: 'text-blue-400',
  professional: 'text-purple-400', pro: 'text-purple-400', enterprise: 'text-yellow-400',
  max: 'text-yellow-400', beta_customer: 'text-green-400',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  trial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  expired: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-admin-card text-admin-muted border-admin-border',
  suspended: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

export function SubscriptionsPage() {
  const { data, isLoading } = useSubscriptionOverview();

  if (isLoading) return <div className="flex items-center justify-center py-20 text-admin-muted"><Loader2 className="h-6 w-6 animate-spin mr-3" />Loading...</div>;
  if (!data) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <CreditCard className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
          <p className="text-sm text-admin-muted">Subscription tiers, beta customers, and usage limits</p>
        </div>
      </div>

      {/* Tier + Status breakdown */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">By Tier</h3>
          <div className="space-y-3">
            {data.by_tier.map((t) => (
              <div key={t.subscription_tier} className="flex justify-between items-center">
                <span className={`text-sm font-medium capitalize ${tierColors[t.subscription_tier] || 'text-admin-text'}`}>
                  {t.subscription_tier || 'none'}
                </span>
                <span className="text-lg font-bold text-white">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">By Status</h3>
          <div className="space-y-3">
            {data.by_status.map((s) => (
              <div key={s.subscription_status} className="flex justify-between items-center">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[s.subscription_status] || 'text-admin-muted'}`}>
                  {s.subscription_status || 'none'}
                </span>
                <span className="text-lg font-bold text-white">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Beta customers */}
      {data.beta_customers.length > 0 && (
        <div className="bg-admin-surface border border-admin-border rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-green-400" />Beta Customers ({data.beta_customers.length})
          </h3>
          <div className="space-y-3">
            {data.beta_customers.map((b) => {
              const days = b.days_remaining ? Math.floor(parseFloat(b.days_remaining)) : null;
              return (
                <div key={b.id} className="flex items-center justify-between bg-admin-card border border-admin-border rounded-lg px-4 py-3">
                  <div>
                    <Link to={`/organizations/${b.id}`} className="text-sm font-medium text-admin-accent hover:underline">{b.name}</Link>
                    <p className="text-xs text-admin-muted">{b.subdomain} / {b.user_count} users</p>
                    {b.beta_notes && <p className="text-xs text-admin-muted mt-1">{b.beta_notes}</p>}
                  </div>
                  {days !== null ? (
                    <span className={`text-sm font-bold ${days <= 7 ? 'text-red-400' : days <= 30 ? 'text-yellow-400' : 'text-admin-text'}`}>
                      {days}d left
                    </span>
                  ) : (
                    <span className="text-xs text-admin-muted">No expiry set</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Approaching limits */}
      {data.approaching_limits.length > 0 && (
        <div className="bg-admin-surface border border-admin-border rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />Approaching Limits
          </h3>
          <div className="space-y-3">
            {data.approaching_limits.map((o) => (
              <div key={o.id} className="flex items-center justify-between bg-admin-card border border-admin-border rounded-lg px-4 py-3">
                <div>
                  <Link to={`/organizations/${o.id}`} className="text-sm font-medium text-admin-accent hover:underline">{o.name}</Link>
                  <p className="text-xs text-admin-muted">{o.subdomain} / {o.subscription_tier}</p>
                </div>
                <div className="flex gap-4 text-xs">
                  <span className={parseInt(o.current_users) >= o.max_users * 0.9 ? 'text-red-400' : 'text-yellow-400'}>
                    Users: {o.current_users}/{o.max_users}
                  </span>
                  <span className={parseInt(o.current_programmes) >= o.max_programmes * 0.9 ? 'text-red-400' : 'text-yellow-400'}>
                    Programmes: {o.current_programmes}/{o.max_programmes}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently created orgs */}
      {data.recent_orgs.length > 0 && (
        <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-admin-accent" />Recently Created (30 days)
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-border text-left text-admin-muted text-xs uppercase tracking-wider">
                <th className="pb-3">Organisation</th>
                <th className="pb-3">Tier</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Users</th>
                <th className="pb-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_orgs.map((o) => (
                <tr key={o.id} className="border-b border-admin-border/30">
                  <td className="py-2">
                    <Link to={`/organizations/${o.id}`} className="text-admin-accent hover:underline">{o.name}</Link>
                    <span className="text-admin-muted text-xs ml-2">{o.subdomain}</span>
                  </td>
                  <td className="py-2"><span className={`capitalize ${tierColors[o.subscription_tier] || ''}`}>{o.subscription_tier}</span></td>
                  <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[o.subscription_status] || ''}`}>{o.subscription_status}</span></td>
                  <td className="py-2 text-admin-text">{o.user_count}</td>
                  <td className="py-2 text-admin-muted text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
