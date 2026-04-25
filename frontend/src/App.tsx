import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from './components/layout/AdminLayout';
import { DashboardPage } from './pages/DashboardPage';
import { OrganizationsPage } from './pages/OrganizationsPage';
import { OrganizationDetailPage } from './pages/OrganizationDetailPage';
import { UsersPage } from './pages/UsersPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { AIPromptTemplatesPage } from './pages/AIPromptTemplatesPage';
import { SecurityEventsPage } from './pages/SecurityEventsPage';
import { AIUsagePage } from './pages/AIUsagePage';
import { BroadcastsPage } from './pages/BroadcastsPage';
import { PlatformHealthPage } from './pages/PlatformHealthPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { ReportCompliancePage } from './pages/ReportCompliancePage';
import { OrganizationDefaultsPage } from './pages/OrganizationDefaultsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/organizations" element={<OrganizationsPage />} />
        <Route path="/organization-defaults" element={<OrganizationDefaultsPage />} />
        <Route path="/organizations/:id" element={<OrganizationDetailPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/:id" element={<UserDetailPage />} />
        <Route path="/security" element={<SecurityEventsPage />} />
        <Route path="/ai-prompts" element={<AIPromptTemplatesPage />} />
        <Route path="/ai-usage" element={<AIUsagePage />} />
        <Route path="/broadcasts" element={<BroadcastsPage />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/compliance" element={<ReportCompliancePage />} />
        <Route path="/health" element={<PlatformHealthPage />} />
        <Route path="/audit-log" element={<AuditLogPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
