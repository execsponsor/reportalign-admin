import { useState } from 'react';
import { Users, Search } from 'lucide-react';

export function UsersPage() {
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-admin-muted text-sm mt-1">Manage all users across organizations</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-admin-muted" />
        <input
          type="text"
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-admin-surface border border-admin-border rounded-lg text-admin-text text-sm placeholder:text-admin-muted focus:outline-none focus:ring-2 focus:ring-admin-accent/50 focus:border-admin-accent"
        />
      </div>

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
          <tbody>
            <tr>
              <td colSpan={5} className="px-6 py-12 text-center text-admin-muted">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Connect to the API to load users</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
