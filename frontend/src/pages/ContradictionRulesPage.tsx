/**
 * Contradiction Rules — Super Admin Page
 *
 * View and edit the Predictive Assurance rule library.
 * Shows all 83 system default rules with conditions, prompts, and thresholds.
 */

import { useState } from 'react';
import {
  Shield, Search, Filter, ChevronDown, ChevronRight,
  Edit2, Save, X, AlertTriangle, CheckCircle, Loader2,
} from 'lucide-react';
import { useContradictionRules, useUpdateContradictionRule } from '../hooks/useContradictionRules';
import type { ContradictionRule } from '../hooks/useContradictionRules';

const PACK_LABELS: Record<string, string> = {
  waterfall: 'Waterfall',
  agile: 'Agile',
  hybrid: 'Hybrid',
  pmo: 'PMO',
};

const ARCHETYPE_LABELS: Record<string, string> = {
  rag_vs_reality: 'RAG vs Reality',
  trend_break: 'Trend Break',
  conservation: 'Conservation',
  pace_vs_promise: 'Pace vs Promise',
  engagement_vs_readiness: 'Engagement vs Readiness',
  silence_absence: 'Silence / Absence',
};

const SEVERITY_COLOURS: Record<string, string> = {
  informational: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  recommended: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  mandatory: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export function ContradictionRulesPage() {
  const { data, isLoading, error } = useContradictionRules();
  const updateRule = useUpdateContradictionRule();
  const [search, setSearch] = useState('');
  const [packFilter, setPackFilter] = useState<string>('all');
  const [archetypeFilter, setArchetypeFilter] = useState<string>('all');
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-admin-accent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400">
        <AlertTriangle className="h-6 w-6 mb-2" />
        Failed to load rules: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const { rules, stats } = data;

  // Filter
  const filtered = rules.filter(r => {
    if (packFilter !== 'all' && r.pack !== packFilter) { return false; }
    if (archetypeFilter !== 'all' && r.archetype !== archetypeFilter) { return false; }
    if (search) {
      const s = search.toLowerCase();
      return r.rule_code.toLowerCase().includes(s)
        || r.name.toLowerCase().includes(s)
        || r.pm_challenge_text.toLowerCase().includes(s);
    }
    return true;
  });

  const startEdit = (rule: ContradictionRule) => {
    setEditingRule(rule.id);
    setEditForm({
      pm_challenge_text: rule.pm_challenge_text,
      exec_challenge_text: rule.exec_challenge_text,
      presentation_description: rule.presentation_description || '',
      default_severity: rule.default_severity,
      is_active: rule.is_active,
      tunable_threshold_current: rule.tunable_threshold_current,
    });
  };

  const saveEdit = async (ruleId: string) => {
    await updateRule.mutateAsync({ ruleId, updates: editForm });
    setEditingRule(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-admin-accent" />
          <div>
            <h1 className="text-2xl font-bold text-white">Contradiction Rules</h1>
            <p className="text-sm text-admin-muted">
              Predictive Assurance rule library — {stats.total} rules ({stats.active} active, {stats.mvp} MVP)
            </p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Object.entries(stats.by_pack).map(([pack, count]) => (
          <button
            key={pack}
            onClick={() => setPackFilter(packFilter === pack ? 'all' : pack)}
            className={`p-3 rounded-xl border text-left transition-colors ${
              packFilter === pack
                ? 'bg-admin-accent/20 border-admin-accent/50 text-admin-accent'
                : 'bg-admin-card border-admin-border text-admin-text hover:border-admin-accent/30'
            }`}
          >
            <div className="text-xl font-bold">{count as number}</div>
            <div className="text-xs text-admin-muted">{PACK_LABELS[pack] || pack}</div>
          </button>
        ))}
        {Object.entries(stats.by_archetype).slice(0, 2).map(([arch, count]) => (
          <button
            key={arch}
            onClick={() => setArchetypeFilter(archetypeFilter === arch ? 'all' : arch)}
            className={`p-3 rounded-xl border text-left transition-colors ${
              archetypeFilter === arch
                ? 'bg-admin-accent/20 border-admin-accent/50 text-admin-accent'
                : 'bg-admin-card border-admin-border text-admin-text hover:border-admin-accent/30'
            }`}
          >
            <div className="text-xl font-bold">{count as number}</div>
            <div className="text-xs text-admin-muted truncate">{ARCHETYPE_LABELS[arch] || arch}</div>
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-admin-muted" />
          <input
            type="text"
            placeholder="Search rules by code, name, or challenge text..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-admin-card border border-admin-border text-admin-text text-sm placeholder:text-admin-muted focus:border-admin-accent focus:outline-none"
          />
        </div>
        <select
          value={packFilter}
          onChange={e => setPackFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg bg-admin-card border border-admin-border text-admin-text text-sm focus:border-admin-accent focus:outline-none"
        >
          <option value="all">All packs</option>
          {Object.entries(PACK_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={archetypeFilter}
          onChange={e => setArchetypeFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg bg-admin-card border border-admin-border text-admin-text text-sm focus:border-admin-accent focus:outline-none"
        >
          <option value="all">All archetypes</option>
          {Object.entries(ARCHETYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Rules list */}
      <div className="space-y-2">
        {filtered.map(rule => {
          const isExpanded = expandedRule === rule.id;
          const isEditing = editingRule === rule.id;

          return (
            <div key={rule.id} className="bg-admin-card border border-admin-border rounded-xl overflow-hidden">
              {/* Rule header row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-admin-surface/50 transition-colors"
                onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
              >
                {isExpanded
                  ? <ChevronDown className="h-4 w-4 text-admin-muted shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-admin-muted shrink-0" />
                }
                <span className="font-mono text-xs text-admin-accent w-16 shrink-0">{rule.rule_code}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${SEVERITY_COLOURS[rule.default_severity] || ''}`}>
                  {rule.default_severity}
                </span>
                <span className="text-sm text-admin-text flex-1 truncate">{rule.name}</span>
                <span className="text-[10px] text-admin-muted px-2 py-0.5 rounded bg-admin-surface">
                  {PACK_LABELS[rule.pack]}
                </span>
                {rule.is_mvp && (
                  <span className="text-[10px] text-green-400 px-2 py-0.5 rounded bg-green-500/10 border border-green-500/30">
                    MVP
                  </span>
                )}
                {!rule.is_active && (
                  <span className="text-[10px] text-red-400 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30">
                    Disabled
                  </span>
                )}
                {rule.override_count > 0 && (
                  <span className="text-[10px] text-admin-muted">
                    {rule.override_count} override{rule.override_count > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-admin-border px-4 py-4 space-y-4">
                  {/* Description */}
                  {rule.presentation_description && (
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-admin-muted font-medium">Description</label>
                      <p className="text-sm text-admin-text mt-1">{rule.presentation_description}</p>
                    </div>
                  )}

                  {/* Conditions summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-admin-muted font-medium">Condition</label>
                      <div className="text-xs text-admin-text mt-1 space-y-1">
                        {rule.indicator_a && <div>Indicator A: <span className="text-admin-accent">{rule.indicator_a}</span> {rule.indicator_a_condition}</div>}
                        {rule.indicator_b && <div>Indicator B: <span className="text-admin-accent">{rule.indicator_b}</span> {rule.indicator_b_condition}</div>}
                        {rule.temporal_indicator && <div>Temporal: <span className="text-admin-accent">{rule.temporal_indicator}</span></div>}
                        {rule.quality_dimension && <div>Quality: <span className="text-admin-accent">{rule.quality_dimension}</span></div>}
                        {rule.portfolio_criterion && <div>Portfolio: <span className="text-admin-accent">{rule.portfolio_criterion}</span></div>}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-admin-muted font-medium">Metadata</label>
                      <div className="text-xs text-admin-text mt-1 space-y-1">
                        <div>Archetype: <span className="text-admin-accent">{ARCHETYPE_LABELS[rule.archetype]}</span></div>
                        <div>Outcome tags: <span className="text-admin-accent">{rule.outcome_tags.join(', ')}</span></div>
                        <div>Escalation: after {rule.escalate_after_cycles} cycles → {rule.escalate_to}</div>
                        {rule.tunable_threshold_name && (
                          <div>Threshold: <span className="text-admin-accent">{rule.tunable_threshold_label}</span> = {rule.tunable_threshold_current} (range {rule.tunable_threshold_min}–{rule.tunable_threshold_max})</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Challenge texts */}
                  {!isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-admin-muted font-medium">PM Challenge Text</label>
                        <p className="text-sm text-admin-text mt-1 whitespace-pre-wrap bg-admin-surface rounded p-3">{rule.pm_challenge_text}</p>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-admin-muted font-medium">Exec Challenge Text</label>
                        <p className="text-sm text-admin-text mt-1 whitespace-pre-wrap bg-admin-surface rounded p-3">{rule.exec_challenge_text}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(rule); }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-admin-accent border border-admin-accent/30 hover:bg-admin-accent/10 transition-colors"
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit Rule
                      </button>
                    </div>
                  ) : (
                    /* Edit form */
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-admin-muted font-medium">PM Challenge Text</label>
                        <textarea
                          value={editForm.pm_challenge_text as string}
                          onChange={e => setEditForm({ ...editForm, pm_challenge_text: e.target.value })}
                          rows={4}
                          className="w-full mt-1 px-3 py-2 rounded-lg bg-admin-surface border border-admin-border text-admin-text text-sm focus:border-admin-accent focus:outline-none resize-y"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-admin-muted font-medium">Exec Challenge Text</label>
                        <textarea
                          value={editForm.exec_challenge_text as string}
                          onChange={e => setEditForm({ ...editForm, exec_challenge_text: e.target.value })}
                          rows={3}
                          className="w-full mt-1 px-3 py-2 rounded-lg bg-admin-surface border border-admin-border text-admin-text text-sm focus:border-admin-accent focus:outline-none resize-y"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-admin-muted font-medium">Severity</label>
                          <select
                            value={editForm.default_severity as string}
                            onChange={e => setEditForm({ ...editForm, default_severity: e.target.value })}
                            className="w-full mt-1 px-3 py-2 rounded-lg bg-admin-surface border border-admin-border text-admin-text text-sm focus:border-admin-accent focus:outline-none"
                          >
                            <option value="informational">Informational</option>
                            <option value="recommended">Recommended</option>
                            <option value="mandatory">Mandatory</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-admin-muted font-medium">Active</label>
                          <select
                            value={String(editForm.is_active)}
                            onChange={e => setEditForm({ ...editForm, is_active: e.target.value === 'true' })}
                            className="w-full mt-1 px-3 py-2 rounded-lg bg-admin-surface border border-admin-border text-admin-text text-sm focus:border-admin-accent focus:outline-none"
                          >
                            <option value="true">Active</option>
                            <option value="false">Disabled</option>
                          </select>
                        </div>
                        {rule.tunable_threshold_name && (
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-admin-muted font-medium">
                              {rule.tunable_threshold_label || 'Threshold'}
                            </label>
                            <input
                              type="number"
                              value={editForm.tunable_threshold_current as number ?? ''}
                              onChange={e => setEditForm({ ...editForm, tunable_threshold_current: parseInt(e.target.value) || null })}
                              min={rule.tunable_threshold_min ?? undefined}
                              max={rule.tunable_threshold_max ?? undefined}
                              className="w-full mt-1 px-3 py-2 rounded-lg bg-admin-surface border border-admin-border text-admin-text text-sm focus:border-admin-accent focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(rule.id)}
                          disabled={updateRule.isPending}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-admin-accent text-white hover:bg-admin-accent/90 transition-colors disabled:opacity-50"
                        >
                          {updateRule.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditingRule(null)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-admin-muted border border-admin-border hover:bg-admin-surface transition-colors"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-admin-muted">
          No rules match your filters.
        </div>
      )}
    </div>
  );
}
