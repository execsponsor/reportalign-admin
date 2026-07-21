/**
 * Signal Detection Rules — Super Admin Master Library Management
 *
 * Manages the master rule library. Rules here are seeded to new orgs.
 * Super-admins can create, edit, disable, delete rules and push updates to all orgs.
 */

import { useState } from 'react';
import {
  Shield, Search, Plus, Edit2, Trash2, Save, X, Send,
  AlertTriangle, TrendingDown, FileQuestion, Eye,
} from 'lucide-react';
import {
  useSignalDetectionRules, useRuleStats,
  useCreateMasterRule, useUpdateMasterRule, useDeleteMasterRule, usePushRuleToOrgs,
} from '../hooks/useContradictionRules';
import type { SignalDetectionRule, CreateRuleInput, UpdateRuleInput } from '../hooks/useContradictionRules';

const TYPE_LABELS: Record<string, string> = {
  internal_contradiction: 'Internal Contradiction',
  trend_anomaly: 'Trend Anomaly',
  omission: 'Omission',
};

const TYPE_ICONS: Record<string, typeof AlertTriangle> = {
  internal_contradiction: AlertTriangle,
  trend_anomaly: TrendingDown,
  omission: FileQuestion,
};

const TYPE_COLOURS: Record<string, string> = {
  internal_contradiction: 'bg-red-500/15 text-red-300',
  trend_anomaly: 'bg-amber-500/15 text-amber-300',
  omission: 'bg-blue-500/15 text-blue-300',
};

const inputClass = 'w-full bg-admin-bg border border-admin-border rounded px-3 py-2 text-sm text-admin-text placeholder:text-admin-muted focus:outline-none focus:ring-2 focus:ring-admin-accent';

function RuleFormDialog({ rule, onSave, onCancel }: {
  rule?: SignalDetectionRule;
  onSave: (data: CreateRuleInput | UpdateRuleInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    ruleCode: rule?.ruleCode || '',
    name: rule?.name || '',
    contradictionType: rule?.contradictionType || 'internal_contradiction',
    triggerLogic: rule?.triggerLogic || '',
    whyItMatters: rule?.whyItMatters || '',
    surfacedText: rule?.surfacedText || '',
    outcomeRelevance: (rule?.outcomeRelevance || []).join(', '),
    enabled: rule?.enabled !== false,
  });

  const isEdit = !!rule;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-admin-surface border border-admin-border text-admin-text rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <h2 className="text-lg font-bold text-white">{isEdit ? 'Edit Rule' : 'Create New Master Rule'}</h2>

        {!isEdit && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-admin-muted">Rule Code *</label>
              <input className={inputClass} placeholder="IC-13, TA-10, OM-11..."
                value={form.ruleCode} onChange={e => setForm({ ...form, ruleCode: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-admin-muted">Type *</label>
              <select className={inputClass}
                value={form.contradictionType} onChange={e => setForm({ ...form, contradictionType: e.target.value })}>
                <option value="internal_contradiction">Internal Contradiction</option>
                <option value="trend_anomaly">Trend Anomaly</option>
                <option value="omission">Omission</option>
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1 text-admin-muted">Name *</label>
          <input className={inputClass} placeholder="Short descriptive name"
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-admin-muted">Trigger Logic (IF/THEN) *</label>
          <textarea className={inputClass} rows={3} placeholder="IF condition THEN fire."
            value={form.triggerLogic} onChange={e => setForm({ ...form, triggerLogic: e.target.value })} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-admin-muted">Surfaced Text (shown to users) *</label>
          <textarea className={inputClass} rows={2} placeholder="Specific, factual text shown when rule fires"
            value={form.surfacedText} onChange={e => setForm({ ...form, surfacedText: e.target.value })} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-admin-muted">Why It Matters</label>
          <textarea className={inputClass} rows={2} placeholder="Practitioner reasoning"
            value={form.whyItMatters} onChange={e => setForm({ ...form, whyItMatters: e.target.value })} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-admin-muted">Outcome Relevance (comma-separated)</label>
          <input className={inputClass} placeholder="late_delivery, cost_overrun, benefits_shortfall, scope_erosion"
            value={form.outcomeRelevance} onChange={e => setForm({ ...form, outcomeRelevance: e.target.value })} />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="enabled" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />
          <label htmlFor="enabled" className="text-sm text-admin-muted">Enabled by default for new orgs</label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-admin-border">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-admin-border rounded text-admin-text hover:bg-admin-card flex items-center gap-2">
            <X className="h-4 w-4" /> Cancel
          </button>
          <button onClick={() => {
            const outcomes = form.outcomeRelevance.split(',').map(s => s.trim()).filter(Boolean);
            if (isEdit) {
              onSave({ name: form.name, triggerLogic: form.triggerLogic, whyItMatters: form.whyItMatters, surfacedText: form.surfacedText, outcomeRelevance: outcomes, enabled: form.enabled });
            } else {
              onSave({ ruleCode: form.ruleCode, name: form.name, contradictionType: form.contradictionType, triggerLogic: form.triggerLogic, whyItMatters: form.whyItMatters, surfacedText: form.surfacedText, outcomeRelevance: outcomes, enabled: form.enabled });
            }
          }} className="px-4 py-2 text-sm bg-admin-accent text-white rounded hover:bg-admin-accent-hover flex items-center gap-2">
            <Save className="h-4 w-4" /> {isEdit ? 'Save Changes' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContradictionRulesPage() {
  const { data: rules, isLoading, error } = useSignalDetectionRules();
  const { data: stats } = useRuleStats();
  const createMutation = useCreateMasterRule();
  const updateMutation = useUpdateMasterRule();
  const deleteMutation = useDeleteMasterRule();
  const pushMutation = usePushRuleToOrgs();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editingRule, setEditingRule] = useState<SignalDetectionRule | null>(null);

  const filtered = (rules || []).filter(r => {
    if (typeFilter !== 'all' && r.contradictionType !== typeFilter) { return false; }
    if (search) {
      const q = search.toLowerCase();
      return r.ruleCode.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.surfacedText.toLowerCase().includes(q);
    }
    return true;
  });

  const handleCreate = async (data: CreateRuleInput | UpdateRuleInput) => {
    await createMutation.mutateAsync(data as CreateRuleInput);
    setShowCreate(false);
  };

  const handleUpdate = async (data: CreateRuleInput | UpdateRuleInput) => {
    if (!editingRule) { return; }
    await updateMutation.mutateAsync({ ruleId: editingRule.id, data: data as UpdateRuleInput });
    setEditingRule(null);
  };

  const handleDelete = async (rule: SignalDetectionRule) => {
    if (!confirm(`Delete master rule ${rule.ruleCode}: ${rule.name}?\n\nThis will NOT remove it from existing orgs.`)) { return; }
    await deleteMutation.mutateAsync(rule.id);
  };

  const handlePush = async (rule: SignalDetectionRule) => {
    if (!confirm(`Push updates for ${rule.ruleCode} to all orgs?\n\nThis will update the rule text for all orgs that haven't customised it.`)) { return; }
    const result = await pushMutation.mutateAsync(rule.id);
    alert(`Updated ${(result as { orgsUpdated: number }).orgsUpdated} organisations.`);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-admin-muted">Loading rules...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-400">Error: {(error as Error).message}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-admin-accent" />
          <div>
            <h1 className="text-2xl font-bold text-white">Master Rule Library</h1>
            <p className="text-sm text-admin-muted">Rules here are seeded to new organisations. Push updates to sync existing orgs.</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-admin-accent text-white rounded-lg hover:bg-admin-accent-hover flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" /> New Rule
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-admin-surface border border-admin-border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-admin-text">{rules?.length || 0}</p>
            <p className="text-xs text-admin-muted">Master Rules</p>
          </div>
          <div className="bg-admin-surface border border-admin-border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-admin-text">{stats.totalOrganizations}</p>
            <p className="text-xs text-admin-muted">Active Orgs</p>
          </div>
          {stats.byType.map(bt => (
            <div key={bt.contradictionType} className="bg-admin-surface border border-admin-border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-admin-text">{bt.ruleCount}</p>
              <p className="text-xs text-admin-muted">{TYPE_LABELS[bt.contradictionType] || bt.contradictionType}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-admin-muted" />
          <input className="w-full pl-9 pr-3 py-2 bg-admin-surface border border-admin-border rounded-lg text-sm text-admin-text placeholder:text-admin-muted focus:outline-none focus:ring-2 focus:ring-admin-accent" placeholder="Search rules..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="bg-admin-surface border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text focus:outline-none focus:ring-2 focus:ring-admin-accent" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="internal_contradiction">Internal Contradiction</option>
          <option value="trend_anomaly">Trend Anomaly</option>
          <option value="omission">Omission</option>
        </select>
      </div>

      <div className="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-admin-card">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-admin-muted">Code</th>
              <th className="px-4 py-3 text-left font-medium text-admin-muted">Name</th>
              <th className="px-4 py-3 text-left font-medium text-admin-muted">Type</th>
              <th className="px-4 py-3 text-left font-medium text-admin-muted">Surfaced Text</th>
              <th className="px-4 py-3 text-center font-medium text-admin-muted">Orgs</th>
              <th className="px-4 py-3 text-center font-medium text-admin-muted">Disabled</th>
              <th className="px-4 py-3 text-center font-medium text-admin-muted">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border">
            {filtered.map((rule: SignalDetectionRule) => {
              const Icon = TYPE_ICONS[rule.contradictionType] || Eye;
              return (
                <tr key={rule.id} className={`text-admin-text hover:bg-admin-card ${!rule.enabled ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs font-medium">{rule.ruleCode}</td>
                  <td className="px-4 py-3 font-medium">{rule.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLOURS[rule.contradictionType] || 'bg-admin-card text-admin-muted'}`}>
                      <Icon className="h-3 w-3" />
                      {TYPE_LABELS[rule.contradictionType] || rule.contradictionType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-admin-muted max-w-xs truncate" title={rule.surfacedText}>{rule.surfacedText}</td>
                  <td className="px-4 py-3 text-center">{rule.orgCount}</td>
                  <td className="px-4 py-3 text-center">
                    {rule.disabledByOrgs > 0 ? <span className="text-amber-400 font-medium">{rule.disabledByOrgs}</span> : <span className="text-admin-muted">0</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setEditingRule(rule)} className="p-1.5 rounded hover:bg-admin-bg" title="Edit"><Edit2 className="h-3.5 w-3.5 text-admin-muted" /></button>
                      <button onClick={() => handlePush(rule)} className="p-1.5 rounded hover:bg-blue-500/10" title="Push to all orgs" disabled={pushMutation.isPending}><Send className="h-3.5 w-3.5 text-blue-400" /></button>
                      <button onClick={() => handleDelete(rule)} className="p-1.5 rounded hover:bg-red-500/10" title="Delete" disabled={deleteMutation.isPending}><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-8 text-center text-admin-muted">No rules match your filters.</div>}
      </div>

      {showCreate && <RuleFormDialog onSave={handleCreate} onCancel={() => setShowCreate(false)} />}
      {editingRule && <RuleFormDialog rule={editingRule} onSave={handleUpdate} onCancel={() => setEditingRule(null)} />}
    </div>
  );
}
