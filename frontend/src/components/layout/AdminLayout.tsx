import { Outlet, NavLink } from 'react-router-dom';
import { useMsal, useAccount } from '@azure/msal-react';
import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldAlert,
  Sparkles,
  Brain,
  CreditCard,
  FileBarChart,
  Megaphone,
  Heart,
  ScrollText,
  Shield,
  LogOut,
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/organizations', label: 'Organizations', icon: Building2 },
  { path: '/users', label: 'Users', icon: Users },
  { path: '/security', label: 'Security', icon: ShieldAlert },
  { path: '/ai-prompts', label: 'AI Prompts', icon: Sparkles },
  { path: '/ai-usage', label: 'AI Usage', icon: Brain },
  { path: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { path: '/compliance', label: 'Compliance', icon: FileBarChart },
  { path: '/broadcasts', label: 'Broadcasts', icon: Megaphone },
  { path: '/health', label: 'Health', icon: Heart },
  { path: '/audit-log', label: 'Audit Log', icon: ScrollText },
];

export function AdminLayout() {
  const { instance, accounts } = useMsal();
  const account = useAccount(accounts[0] ?? null);

  const displayName = account?.name || account?.username || 'Super Admin';
  const email = account?.username || '';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const handleLogout = () => {
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
  };

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

        {/* User Footer */}
        <div className="p-4 border-t border-admin-border">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-admin-card flex items-center justify-center text-xs font-bold text-admin-accent">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-admin-text text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-admin-muted truncate">{email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-1.5 rounded-lg text-admin-muted hover:text-red-400 hover:bg-admin-card transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
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
