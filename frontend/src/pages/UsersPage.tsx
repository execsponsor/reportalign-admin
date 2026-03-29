import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, ChevronLeft, ChevronRight, Loader2, Lock } from 'lucide-react';
import { useUsers } from '../hooks/useUsers';

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useUsers({
    page,
    search: search || undefined,
  });

  const users = data?.users ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-admin-muted text-sm mt-1">
          {pagination ? `${pagination.total} total users` : 'Manage all users across organizations'}
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-admin-muted" />
        <input
          type="text"
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2.5 bg-admin-surface border border-admin-border rounded-lg text-admin-text text-sm placeholder:text-admin-muted focus:outline-none focus:ring-2 focus:ring-admin-accent/50 focus:border-admin-accent"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          Failed to load users. {(error as Error).message}
        </div>
      )}

      <div className="bg-admin-surface border border-admin-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-admin-border">
              <th className="text-left px-6 py-4 text-xs font-semibold text-admin-muted uppercase tracking-wider">User</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-admin-muted uppercase tracking-wider">Email</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-admin-muted uppercase tracking-wider">Organizations</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-admin-muted uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-admin-muted uppercase tracking-wider">Last Login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-admin-accent mx-auto" />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-admin-muted">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No users found</p>
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isLocked = user.locked_until && new Date(user.locked_until) > new Date();
                return (
                  <tr key={user.id} className="hover:bg-admin-card/50 transition-colors">
                    <td className="px-6 py-4">
                      <Link to={`/users/${user.id}`} className="text-white font-medium hover:text-admin-accent transition-colors">
                        {user.first_name} {user.last_name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-admin-text text-sm">{user.email}</span>
                    </td>
                    <td className="px-6 py-4">
                      {user.organizations?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {user.organizations.map((o, i) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-admin-card text-admin-text">
                              {o.org_name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-admin-muted text-xs">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isLocked ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      ) : user.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-admin-muted text-sm">
                      {user.last_login
                        ? new Date(user.last_login).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : 'Never'}
                    </td>
                  </tr>
                );
              })
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
