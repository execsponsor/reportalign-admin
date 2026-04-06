import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus, Search, ChevronRight, ChevronLeft, Loader2, X, Copy, Check } from 'lucide-react';
import { useOrganizations, useCreateOrganization } from '../hooks/useOrganizations';

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

interface CreateResult {
  organizationId: string;
  subdomain: string;
  url: string;
  adminEmail: string;
  adminPassword: string;
  userId: string;
  subscription: { tier: string; maxUsers: number; maxProgrammes: number };
}

export function OrganizationsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [tier, setTier] = useState('');
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
          onClick={() => setShowCreateModal(true)}
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

      {/* Create Organization Modal */}
      {showCreateModal && (
        <CreateOrganizationModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

function CreateOrganizationModal({ onClose }: { onClose: () => void }) {
  const createOrg = useCreateOrganization();
  const [form, setForm] = useState({
    name: '',
    subdomain: '',
    organizationType: 'corporate',
    adminEmail: '',
    subscriptionTier: 'standard',
  });
  const [result, setResult] = useState<CreateResult | null>(null);
  const [formError, setFormError] = useState('');
  const [copied, setCopied] = useState(false);

  const updateField = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFormError('');
    // Auto-generate subdomain from name
    if (field === 'name') {
      const sub = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
      setForm((f) => ({ ...f, [field]: value, subdomain: sub }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.subdomain || !form.adminEmail) {
      setFormError('Please fill in all required fields');
      return;
    }
    try {
      const data = await createOrg.mutateAsync(form) as CreateResult;
      setResult(data);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg || 'Failed to create organization');
    }
  };

  const copyCredentials = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(
      `URL: ${result.url}\nAdmin Email: ${result.adminEmail}\nPassword: ${result.adminPassword}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-admin-surface border border-admin-border rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-admin-border">
          <h2 className="text-lg font-semibold text-white">
            {result ? 'Organization Created' : 'Create Organization'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-admin-muted hover:text-white hover:bg-admin-card transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {result ? (
          /* Success View */
          <div className="p-6 space-y-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <p className="text-green-400 font-medium text-sm">Organization provisioned successfully</p>
              <p className="text-admin-muted text-xs mt-1">Save the admin password below — it will not be shown again.</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-admin-muted text-sm">URL</span>
                <code className="text-admin-accent text-sm font-mono">{result.url}</code>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-admin-muted text-sm">Admin Email</span>
                <span className="text-admin-text text-sm">{result.adminEmail}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-admin-muted text-sm">Password</span>
                <code className="text-yellow-400 text-sm font-mono">{result.adminPassword}</code>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-admin-muted text-sm">Tier</span>
                <span className="text-admin-text text-sm capitalize">{result.subscription.tier.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-admin-muted text-sm">Limits</span>
                <span className="text-admin-text text-sm">{result.subscription.maxUsers} users, {result.subscription.maxProgrammes} programmes</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={copyCredentials}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-admin-accent hover:bg-admin-accent-hover text-white rounded-lg font-medium text-sm transition-colors"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy Credentials'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 bg-admin-card hover:bg-admin-border text-admin-text rounded-lg font-medium text-sm border border-admin-border transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {formError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-admin-muted text-sm mb-1.5">Organization Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g. Acme Corporation"
                className="w-full px-4 py-2.5 bg-admin-card border border-admin-border rounded-lg text-admin-text text-sm placeholder:text-admin-muted focus:outline-none focus:ring-2 focus:ring-admin-accent/50 focus:border-admin-accent"
              />
            </div>

            <div>
              <label className="block text-admin-muted text-sm mb-1.5">Subdomain *</label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={form.subdomain}
                  onChange={(e) => setForm((f) => ({ ...f, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  placeholder="acme"
                  className="flex-1 px-4 py-2.5 bg-admin-card border border-admin-border rounded-l-lg text-admin-text text-sm font-mono placeholder:text-admin-muted focus:outline-none focus:ring-2 focus:ring-admin-accent/50 focus:border-admin-accent"
                />
                <span className="px-3 py-2.5 bg-admin-border border border-admin-border border-l-0 rounded-r-lg text-admin-muted text-sm">
                  .execsponsor.com
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-admin-muted text-sm mb-1.5">Organization Type</label>
                <select
                  value={form.organizationType}
                  onChange={(e) => updateField('organizationType', e.target.value)}
                  className="w-full px-4 py-2.5 bg-admin-card border border-admin-border rounded-lg text-admin-text text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
                >
                  <option value="corporate">Corporate</option>
                  <option value="public_sector">Public Sector</option>
                  <option value="non_profit">Non-Profit</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="education">Education</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-admin-muted text-sm mb-1.5">Subscription Tier</label>
                <select
                  value={form.subscriptionTier}
                  onChange={(e) => updateField('subscriptionTier', e.target.value)}
                  className="w-full px-4 py-2.5 bg-admin-card border border-admin-border rounded-lg text-admin-text text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
                >
                  <option value="standard">Standard (10 users, 20 programmes)</option>
                  <option value="pro">Pro (50 users, 100 programmes)</option>
                  <option value="max">Max (999 users, 999 programmes)</option>
                  <option value="beta_customer">Beta Customer (50 users, 100 programmes)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-admin-muted text-sm mb-1.5">Admin Email *</label>
              <input
                type="email"
                value={form.adminEmail}
                onChange={(e) => updateField('adminEmail', e.target.value)}
                placeholder="admin@acme.com"
                className="w-full px-4 py-2.5 bg-admin-card border border-admin-border rounded-lg text-admin-text text-sm placeholder:text-admin-muted focus:outline-none focus:ring-2 focus:ring-admin-accent/50 focus:border-admin-accent"
              />
              <p className="text-admin-muted text-xs mt-1">A password will be auto-generated for this user</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={createOrg.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-admin-accent hover:bg-admin-accent-hover text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
              >
                {createOrg.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>
                ) : (
                  <><Building2 className="h-4 w-4" /> Create Organization</>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-admin-card hover:bg-admin-border text-admin-text rounded-lg font-medium text-sm border border-admin-border transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
