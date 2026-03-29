import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Building2, Users, FolderKanban, Calendar, Globe, Shield,
  Loader2, AlertTriangle, CheckCircle, XCircle, PauseCircle, PlayCircle,
} from 'lucide-react';
import { useOrganization, useUpdateOrganization } from '../hooks/useOrganizations';

const tierLabels: Record<string, string> = {
  standard: 'Standard',
  pro: 'Pro',
  max: 'Max',
  beta_customer: 'Beta Customer',
};

export function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: org, isLoading, error } = useOrganization(id);
  const updateOrg = useUpdateOrganization();
  const [actionPending, setActionPending] = useState<string | null>(null);

  const handleAction = async (action: string, body: Record<string, unknown>) => {
    if (!id) return;
    setActionPending(action);
    try {
      await updateOrg.mutateAsync({ id, ...body });
    } finally {
      setActionPending(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-admin-accent" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="space-y-4">
        <Link to="/organizations" className="flex items-center gap-2 text-admin-muted hover:text-white text-sm transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Organizations
        </Link>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400">
          <AlertTriangle className="h-6 w-6 mb-2" />
          Organization not found or failed to load.
        </div>
      </div>
    );
  }

  const isActive = org.is_active;
  const isSuspended = org.subscription_status === 'suspended';

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link to="/organizations" className="flex items-center gap-2 text-admin-muted hover:text-white text-sm transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Organizations
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-admin-accent/10 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-admin-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{org.name}</h1>
            <p className="text-admin-muted text-sm mt-0.5">
              <code className="font-mono">{org.subdomain}</code>
              <span className="mx-2">·</span>
              <span className="capitalize">{org.organization_type.replace('_', ' ')}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isActive && !isSuspended && (
            <button
              onClick={() => handleAction('suspend', { subscriptionStatus: 'suspended' })}
              disabled={!!actionPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 text-sm transition-colors disabled:opacity-50"
            >
              <PauseCircle className="h-4 w-4" />
              {actionPending === 'suspend' ? 'Suspending...' : 'Suspend'}
            </button>
          )}
          {isSuspended && (
            <button
              onClick={() => handleAction('activate', { subscriptionStatus: 'active', isActive: true })}
              disabled={!!actionPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 text-sm transition-colors disabled:opacity-50"
            >
              <PlayCircle className="h-4 w-4" />
              {actionPending === 'activate' ? 'Activating...' : 'Activate'}
            </button>
          )}
          {isActive ? (
            <button
              onClick={() => handleAction('deactivate', { isActive: false })}
              disabled={!!actionPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm transition-colors disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              {actionPending === 'deactivate' ? 'Deactivating...' : 'Deactivate'}
            </button>
          ) : (
            <button
              onClick={() => handleAction('reactivate', { isActive: true })}
              disabled={!!actionPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 text-sm transition-colors disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              {actionPending === 'reactivate' ? 'Reactivating...' : 'Reactivate'}
            </button>
          )}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard icon={Shield} label="Status" value={org.subscription_status} capitalize />
        <InfoCard icon={Globe} label="Tier" value={tierLabels[org.subscription_tier] || org.subscription_tier} />
        <InfoCard icon={Users} label="Users" value={`${org.user_count} / ${org.max_users}`} />
        <InfoCard icon={FolderKanban} label="Programmes" value={`${org.programme_count} / ${org.max_programmes}`} />
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-admin-surface border border-admin-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Organization Details</h2>
          <dl className="space-y-3">
            <DetailRow label="ID" value={org.id} mono />
            <DetailRow label="Active" value={isActive ? 'Yes' : 'No'} />
            <DetailRow label="Beta Customer" value={org.is_beta_customer ? 'Yes' : 'No'} />
            <DetailRow label="Brand Color" value={org.primary_brand_color || '—'} />
            <DetailRow label="Created" value={new Date(org.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
            {org.updated_at && (
              <DetailRow label="Updated" value={new Date(org.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
            )}
          </dl>
        </div>

        <div className="bg-admin-surface border border-admin-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Admin Contact</h2>
          {org.admin_info ? (
            <dl className="space-y-3">
              <DetailRow label="Name" value={`${org.admin_info.first_name} ${org.admin_info.last_name}`} />
              <DetailRow label="Email" value={org.admin_info.email} />
              <DetailRow
                label="Last Login"
                value={org.admin_info.last_login
                  ? new Date(org.admin_info.last_login).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : 'Never'}
              />
            </dl>
          ) : (
            <p className="text-admin-muted text-sm">No admin user found</p>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, capitalize }: { icon: typeof Shield; label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="bg-admin-surface border border-admin-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-admin-muted text-xs mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`text-white font-semibold ${capitalize ? 'capitalize' : ''}`}>{value}</p>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start">
      <dt className="text-admin-muted text-sm">{label}</dt>
      <dd className={`text-admin-text text-sm text-right ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
