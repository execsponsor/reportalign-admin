import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  ScrollText,
  Shield,
  LogOut,
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/organizations', label: 'Organizations', icon: Building2 },
  { path: '/users', label: 'Users', icon: Users },
  { path: '/audit-log', label: 'Audit Log', icon: ScrollText },
];

export function AdminLayout() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-admin-surface border-r border-admin-border flex flex-col shrink-0">
        {/* Logo / Branding */}
        <div className="p-6 border-b border-admin-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-admin-accent flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">ExecSponsor</h1>
              <p className="text-xs text-admin-accent font-medium tracking-wider uppercase admin-pulse">
                Admin Portal
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-admin-accent text-white shadow-lg shadow-admin-accent/25'
                    : 'text-admin-muted hover:text-white hover:bg-admin-card'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-admin-border">
          <div className="flex items-center gap-3 px-4 py-2 text-sm text-admin-muted">
            <div className="w-8 h-8 rounded-full bg-admin-card flex items-center justify-center text-xs font-bold text-admin-accent">
              SA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-admin-text text-sm font-medium truncate">Super Admin</p>
              <p className="text-xs text-admin-muted truncate">Authenticated via Entra ID</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
