import { CreditCard, AlertTriangle, Loader2, Clock } from 'lucide-react';
import { useSubscriptionOverview } from '../hooks/useSubscriptions';
import { Link } from 'react-router-dom';

const tierColors: Record<string, string> = {
  free: 'text-admin-muted',
  starter: 'text-blue-400',
  standard: 'text-blue-400',
  professional: 'text-purple-400',
  pro: 'text-purple-400',
  enterprise: 'text-yellow-400',
  max: 'text-yellow-400',
  beta_customer: 'text-green-400',
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
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <CreditCard className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Subscriptions & Billing</h1>
          <p className="text-sm text-admin-muted">Subscription tiers, trials, limits, and Stripe events</p>
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

      {/* Active trials */}
      {data.active_trials.length > 0 && (
        <div className="bg-admin-surface border border-admin-border rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />Active Trials ({data.active_trials.length})
          </h3>
          <div className="space-y-3">
            {data.active_trials.map((t) => {
              const days = Math.floor(parseFloat(t.days_remaining));
              return (
                <div key={t.id} className="flex items-center justify-between bg-admin-card border border-admin-border rounded-lg px-4 py-3">
                  <div>
                    <Link to={`/organizations/${t.id}`} className="text-sm font-medium text-admin-accent hover:underline">{t.name}</Link>
                    <p className="text-xs text-admin-muted">{t.subdomain} / {t.subscription_tier} / {t.user_count} users</p>
                  </div>
                  <span className={`text-sm font-bold ${days <= 3 ? 'text-red-400' : days <= 7 ? 'text-yellow-400' : 'text-admin-text'}`}>
                    {days}d left
                  </span>
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

      {/* Recent Stripe events */}
      {data.recent_stripe_events.length > 0 && (
        <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Recent Stripe Events</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-border text-left text-admin-muted text-xs uppercase tracking-wider">
                <th className="pb-3">Time</th>
                <th className="pb-3">Event</th>
                <th className="pb-3">Organisation</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_stripe_events.map((e) => (
                <tr key={e.id} className="border-b border-admin-border/30">
                  <td className="py-2 text-xs text-admin-muted">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="py-2 text-xs text-admin-text font-mono">{e.event_type}</td>
                  <td className="py-2 text-xs text-admin-text">{e.org_name || '---'}</td>
                  <td className="py-2">
                    <span className={`text-xs ${e.error_message ? 'text-red-400' : 'text-green-400'}`}>
                      {e.error_message || e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
