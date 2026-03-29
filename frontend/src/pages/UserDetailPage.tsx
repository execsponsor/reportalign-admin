import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, User, Building2, FolderKanban, Loader2, AlertTriangle,
  Lock, Unlock, KeyRound, XCircle, CheckCircle, Copy, Check,
} from 'lucide-react';
import { useUser, useUnlockUser, useResetPassword, useDeactivateUser, useReactivateUser } from '../hooks/useUsers';

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: user, isLoading, error } = useUser(id);
  const unlock = useUnlockUser();
  const resetPw = useResetPassword();
  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();

  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);

  const runAction = async (name: string, fn: () => Promise<unknown>) => {
    setActionPending(name);
    try {
      const result = await fn();
      if (name === 'reset' && result && typeof result === 'object' && 'password' in result) {
        setNewPassword((result as { password: string }).password);
      }
    } finally {
      setActionPending(null);
    }
  };

  const copyPassword = async () => {
    if (!newPassword) return;
    await navigator.clipboard.writeText(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-admin-accent" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <Link to="/users" className="flex items-center gap-2 text-admin-muted hover:text-white text-sm transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Users
        </Link>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400">
          <AlertTriangle className="h-6 w-6 mb-2" />
          User not found or failed to load.
        </div>
      </div>
    );
  }

  const isLocked = user.locked_until && new Date(user.locked_until) > new Date();

  return (
    <div className="space-y-6">
      <Link to="/users" className="flex items-center gap-2 text-admin-muted hover:text-white text-sm transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-admin-accent/10 flex items-center justify-center">
            <User className="h-7 w-7 text-admin-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{user.first_name} {user.last_name}</h1>
            <p className="text-admin-muted text-sm mt-0.5">{user.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isLocked && (
            <button
              onClick={() => runAction('unlock', () => unlock.mutateAsync(user.id))}
              disabled={!!actionPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 text-sm transition-colors disabled:opacity-50"
            >
              <Unlock className="h-4 w-4" />
              {actionPending === 'unlock' ? 'Unlocking...' : 'Unlock'}
            </button>
          )}
          <button
            onClick={() => runAction('reset', () => resetPw.mutateAsync(user.id))}
            disabled={!!actionPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-admin-border text-admin-text hover:bg-admin-card text-sm transition-colors disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {actionPending === 'reset' ? 'Resetting...' : 'Reset Password'}
          </button>
          {user.is_active ? (
            <button
              onClick={() => runAction('deactivate', () => deactivate.mutateAsync(user.id))}
              disabled={!!actionPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm transition-colors disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              {actionPending === 'deactivate' ? 'Deactivating...' : 'Deactivate'}
            </button>
          ) : (
            <button
              onClick={() => runAction('reactivate', () => reactivate.mutateAsync(user.id))}
              disabled={!!actionPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 text-sm transition-colors disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              {actionPending === 'reactivate' ? 'Reactivating...' : 'Reactivate'}
            </button>
          )}
        </div>
      </div>

      {/* New Password Banner */}
      {newPassword && (
        <div className="bg-admin-accent/10 border border-admin-accent/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-admin-accent text-sm font-medium">New password generated</p>
            <code className="text-white font-mono text-sm mt-1 block">{newPassword}</code>
          </div>
          <button onClick={copyPassword} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-admin-accent text-white text-sm hover:bg-admin-accent-hover transition-colors">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}

      {/* User Info + Orgs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-admin-surface border border-admin-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">User Details</h2>
          <dl className="space-y-3">
            <DetailRow label="ID" value={user.id} mono />
            <DetailRow label="Status" value={isLocked ? 'Locked' : user.is_active ? 'Active' : 'Inactive'} />
            <DetailRow label="Email Verified" value={user.email_verified ? 'Yes' : 'No'} />
            <DetailRow label="Failed Login Attempts" value={String(user.failed_login_attempts)} />
            {isLocked && (
              <DetailRow label="Locked Until" value={new Date(user.locked_until!).toLocaleString('en-GB')} />
            )}
            <DetailRow
              label="Last Login"
              value={user.last_login ? new Date(user.last_login).toLocaleString('en-GB') : 'Never'}
            />
            <DetailRow
              label="Created"
              value={new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            />
          </dl>
        </div>

        <div className="space-y-6">
          {/* Organizations */}
          <div className="bg-admin-surface border border-admin-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-admin-accent" />
              Organizations ({user.organizations.length})
            </h2>
            {user.organizations.length > 0 ? (
              <div className="space-y-3">
                {user.organizations.map((o) => (
                  <div key={o.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-admin-card">
                    <div>
                      <Link to={`/organizations/${o.id}`} className="text-white text-sm font-medium hover:text-admin-accent transition-colors">
                        {o.name}
                      </Link>
                      <p className="text-xs text-admin-muted">{o.subdomain}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-admin-text capitalize">{o.access_level}</span>
                      {!o.is_active && (
                        <span className="block text-xs text-red-400">Inactive</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-admin-muted text-sm">Not a member of any organization</p>
            )}
          </div>

          {/* Programme Roles */}
          <div className="bg-admin-surface border border-admin-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-purple-400" />
              Programme Roles ({user.programmes.length})
            </h2>
            {user.programmes.length > 0 ? (
              <div className="space-y-2">
                {user.programmes.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-admin-card">
                    <span className="text-admin-text text-sm">{p.name}</span>
                    <span className="text-xs text-admin-muted capitalize">{p.programme_role}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-admin-muted text-sm">No programme roles assigned</p>
            )}
          </div>
        </div>
      </div>
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
