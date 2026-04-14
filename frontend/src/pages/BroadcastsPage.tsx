import { useState } from 'react';
import { Megaphone, Wrench, Plus, X, Loader2 } from 'lucide-react';
import {
  useBroadcasts, useCreateBroadcast, useUpdateBroadcast,
  useMaintenanceWindows, useCreateMaintenanceWindow, useUpdateMaintenanceWindow,
  type Broadcast, type MaintenanceWindow,
} from '../hooks/useSystemBroadcasts';

const typeColors: Record<string, string> = {
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  notified: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  active: 'bg-red-500/20 text-red-400 border-red-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-admin-card text-admin-muted border-admin-border',
};

export function BroadcastsPage() {
  const [tab, setTab] = useState<'broadcasts' | 'maintenance'>('broadcasts');
  const [showCreateBroadcast, setShowCreateBroadcast] = useState(false);
  const [showCreateMaintenance, setShowCreateMaintenance] = useState(false);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
            <Megaphone className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Broadcasts & Maintenance</h1>
            <p className="text-sm text-admin-muted">Platform announcements and scheduled maintenance windows</p>
          </div>
        </div>
        <button onClick={() => tab === 'broadcasts' ? setShowCreateBroadcast(true) : setShowCreateMaintenance(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-admin-accent hover:bg-admin-accent-hover transition-colors">
          <Plus className="h-4 w-4" />
          {tab === 'broadcasts' ? 'New Broadcast' : 'New Window'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-admin-surface border border-admin-border rounded-lg p-1 mb-6 w-fit">
        <button onClick={() => setTab('broadcasts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'broadcasts' ? 'bg-admin-accent text-white' : 'text-admin-muted hover:text-white'}`}>
          <Megaphone className="h-4 w-4" />Broadcasts
        </button>
        <button onClick={() => setTab('maintenance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'maintenance' ? 'bg-admin-accent text-white' : 'text-admin-muted hover:text-white'}`}>
          <Wrench className="h-4 w-4" />Maintenance
        </button>
      </div>

      {tab === 'broadcasts' && <BroadcastsList />}
      {tab === 'maintenance' && <MaintenanceList />}

      {showCreateBroadcast && <CreateBroadcastModal onClose={() => setShowCreateBroadcast(false)} />}
      {showCreateMaintenance && <CreateMaintenanceModal onClose={() => setShowCreateMaintenance(false)} />}
    </div>
  );
}

// ============================================================================
// Broadcasts List
// ============================================================================

function BroadcastsList() {
  const { data, isLoading } = useBroadcasts();
  const updateBroadcast = useUpdateBroadcast();
  const broadcasts = data?.broadcasts ?? [];

  if (isLoading) return <div className="flex items-center justify-center py-20 text-admin-muted"><Loader2 className="h-6 w-6 animate-spin mr-3" />Loading...</div>;

  return (
    <div className="space-y-3">
      {broadcasts.length === 0 && <p className="text-admin-muted text-center py-12">No broadcasts yet</p>}
      {broadcasts.map((b: Broadcast) => {
        const isActive = b.is_active && (!b.ends_at || new Date(b.ends_at) > new Date());
        const isScheduled = b.is_active && b.starts_at && new Date(b.starts_at) > new Date();
        return (
          <div key={b.id} className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${typeColors[b.broadcast_type]}`}>{b.broadcast_type}</span>
                  {isScheduled ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">Scheduled</span>
                  ) : isActive ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Active</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-admin-card text-admin-muted border border-admin-border">Inactive</span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-white">{b.title}</h3>
                <p className="text-xs text-admin-muted mt-1 line-clamp-2">{b.message}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-admin-muted">
                  {b.starts_at && <span>Starts: {new Date(b.starts_at).toLocaleString()}</span>}
                  {b.ends_at && <span>Ends: {new Date(b.ends_at).toLocaleString()}</span>}
                  <span>{b.total_impressions} views</span>
                  {b.total_clicks > 0 && <span>{b.total_clicks} clicks</span>}
                </div>
              </div>
              <button
                onClick={() => updateBroadcast.mutate({ id: b.id, is_active: !b.is_active })}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${b.is_active ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-green-500/30 text-green-400 hover:bg-green-500/10'}`}>
                {b.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Maintenance List
// ============================================================================

function MaintenanceList() {
  const { data, isLoading } = useMaintenanceWindows();
  const updateWindow = useUpdateMaintenanceWindow();
  const windows = data?.windows ?? [];

  if (isLoading) return <div className="flex items-center justify-center py-20 text-admin-muted"><Loader2 className="h-6 w-6 animate-spin mr-3" />Loading...</div>;

  return (
    <div className="space-y-3">
      {windows.length === 0 && <p className="text-admin-muted text-center py-12">No maintenance windows</p>}
      {windows.map((w: MaintenanceWindow) => (
        <div key={w.id} className="bg-admin-surface border border-admin-border rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[w.status] || statusColors.scheduled}`}>{w.status}</span>
                <span className="text-xs text-admin-muted">{w.reason.replace(/_/g, ' ')}</span>
              </div>
              <h3 className="text-sm font-semibold text-white">{w.title}</h3>
              {w.description && <p className="text-xs text-admin-muted mt-1">{w.description}</p>}
              <div className="flex items-center gap-4 mt-2 text-xs text-admin-muted">
                <span>Scheduled: {new Date(w.scheduled_start).toLocaleString()} -- {new Date(w.scheduled_end).toLocaleString()}</span>
                {w.actual_start && <span>Started: {new Date(w.actual_start).toLocaleString()}</span>}
                {w.actual_end && <span>Ended: {new Date(w.actual_end).toLocaleString()}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              {w.status === 'scheduled' && (
                <button onClick={() => updateWindow.mutate({ id: w.id, status: 'active', actual_start: new Date().toISOString() })}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10">Start Now</button>
              )}
              {w.status === 'active' && (
                <button onClick={() => updateWindow.mutate({ id: w.id, status: 'completed', actual_end: new Date().toISOString() })}
                  className="text-xs px-3 py-1.5 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10">Complete</button>
              )}
              {(w.status === 'scheduled' || w.status === 'notified') && (
                <button onClick={() => updateWindow.mutate({ id: w.id, status: 'cancelled' })}
                  className="text-xs px-3 py-1.5 rounded-lg border border-admin-border text-admin-muted hover:bg-admin-card">Cancel</button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Create Broadcast Modal
// ============================================================================

function CreateBroadcastModal({ onClose }: { onClose: () => void }) {
  const createBroadcast = useCreateBroadcast();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState('info');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [showOnAuth, setShowOnAuth] = useState(false);

  const handleSubmit = async () => {
    await createBroadcast.mutateAsync({
      title, message, broadcast_type: broadcastType,
      starts_at: startsAt || null, ends_at: endsAt || null,
      show_on_auth_pages: showOnAuth, show_on_app: true, is_active: true,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-admin-surface border border-admin-border rounded-xl p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-white">New Broadcast</h2>
          <button onClick={onClose} className="text-admin-muted hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-admin-muted mb-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text" />
          </div>
          <div>
            <label className="block text-xs text-admin-muted mb-1">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
              className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text" />
          </div>
          <div>
            <label className="block text-xs text-admin-muted mb-1">Type</label>
            <select value={broadcastType} onChange={(e) => setBroadcastType(e.target.value)}
              className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text">
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-admin-muted mb-1">Starts At (optional)</label>
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)}
                className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text" />
            </div>
            <div>
              <label className="block text-xs text-admin-muted mb-1">Ends At (optional)</label>
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)}
                className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-admin-text">
            <input type="checkbox" checked={showOnAuth} onChange={(e) => setShowOnAuth(e.target.checked)}
              className="rounded border-admin-border" />
            Show on login/signup pages
          </label>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-admin-muted hover:text-white border border-admin-border">Cancel</button>
          <button onClick={handleSubmit} disabled={!title || !message || createBroadcast.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-admin-accent hover:bg-admin-accent-hover disabled:opacity-50">
            {createBroadcast.isPending ? 'Creating...' : 'Create Broadcast'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Create Maintenance Modal
// ============================================================================

function CreateMaintenanceModal({ onClose }: { onClose: () => void }) {
  const createWindow = useCreateMaintenanceWindow();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('scheduled_maintenance');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');

  const handleSubmit = async () => {
    await createWindow.mutateAsync({
      title, description: description || null, reason,
      scheduled_start: scheduledStart, scheduled_end: scheduledEnd,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-admin-surface border border-admin-border rounded-xl p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-white">Schedule Maintenance</h2>
          <button onClick={onClose} className="text-admin-muted hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-admin-muted mb-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text" />
          </div>
          <div>
            <label className="block text-xs text-admin-muted mb-1">Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text" />
          </div>
          <div>
            <label className="block text-xs text-admin-muted mb-1">Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)}
              className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text">
              <option value="scheduled_maintenance">Scheduled Maintenance</option>
              <option value="security_update">Security Update</option>
              <option value="database_migration">Database Migration</option>
              <option value="infrastructure_upgrade">Infrastructure Upgrade</option>
              <option value="emergency_maintenance">Emergency Maintenance</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-admin-muted mb-1">Scheduled Start</label>
              <input type="datetime-local" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)}
                className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text" />
            </div>
            <div>
              <label className="block text-xs text-admin-muted mb-1">Scheduled End</label>
              <input type="datetime-local" value={scheduledEnd} onChange={(e) => setScheduledEnd(e.target.value)}
                className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-admin-muted hover:text-white border border-admin-border">Cancel</button>
          <button onClick={handleSubmit} disabled={!title || !scheduledStart || !scheduledEnd || createWindow.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-admin-accent hover:bg-admin-accent-hover disabled:opacity-50">
            {createWindow.isPending ? 'Scheduling...' : 'Schedule Maintenance'}
          </button>
        </div>
      </div>
    </div>
  );
}
