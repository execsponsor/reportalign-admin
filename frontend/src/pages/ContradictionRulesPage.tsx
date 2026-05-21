/**
 * Signal Detection Rules — Super Admin Read-Only View
 *
 * Rule management is per-org on the main platform (/Settings > Signal Detection Rules).
 * This page provides cross-org oversight: which rules exist, how many orgs have them,
 * how many orgs have disabled or customised them.
 */

import { useState } from 'react';
import { Shield, Search, Eye, AlertTriangle, TrendingDown, FileQuestion } from 'lucide-react';
import { useSignalDetectionRules, useRuleStats } from '../hooks/useContradictionRules';
import type { SignalDetectionRule } from '../hooks/useContradictionRules';

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
  internal_contradiction: 'bg-red-100 text-red-800',
  trend_anomaly: 'bg-amber-100 text-amber-800',
  omission: 'bg-blue-100 text-blue-800',
};

export default function ContradictionRulesPage() {
  const { data: rules, isLoading, error } = useSignalDetectionRules();
  const { data: stats } = useRuleStats();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filtered = (rules || []).filter(r => {
    if (typeFilter !== 'all' && r.contradictionType !== typeFilter) { return false; }
    if (search) {
      const q = search.toLowerCase();
      return r.ruleCode.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.surfacedText.toLowerCase().includes(q);
    }
    return true;
  });

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading rules...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">Error loading rules: {(error as Error).message}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold">Signal Detection Rules</h1>
            <p className="text-sm text-gray-500">
              Read-only cross-org view. Rule management is per-org on the main platform Settings page.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">{rules?.length || 0}</p>
            <p className="text-xs text-gray-500">Total Rules</p>
          </div>
          <div className="bg-white border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">{stats.totalOrganizations}</p>
            <p className="text-xs text-gray-500">Organizations</p>
          </div>
          {stats.byType.map(bt => (
            <div key={bt.contradictionType} className="bg-white border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">{bt.ruleCount}</p>
              <p className="text-xs text-gray-500">{TYPE_LABELS[bt.contradictionType] || bt.contradictionType}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
            placeholder="Search rules by code, name, or text..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="all">All Types</option>
          <option value="internal_contradiction">Internal Contradiction</option>
          <option value="trend_anomaly">Trend Anomaly</option>
          <option value="omission">Omission</option>
        </select>
      </div>

      {/* Rules table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Code</th>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Surfaced Text</th>
              <th className="px-4 py-3 text-center font-medium">Orgs</th>
              <th className="px-4 py-3 text-center font-medium">Disabled By</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((rule: SignalDetectionRule) => {
              const Icon = TYPE_ICONS[rule.contradictionType] || Eye;
              return (
                <tr key={rule.ruleCode} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{rule.ruleCode}</td>
                  <td className="px-4 py-3 font-medium">{rule.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLOURS[rule.contradictionType] || 'bg-gray-100'}`}>
                      <Icon className="h-3 w-3" />
                      {TYPE_LABELS[rule.contradictionType] || rule.contradictionType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-md truncate" title={rule.surfacedText}>
                    {rule.surfacedText}
                  </td>
                  <td className="px-4 py-3 text-center">{rule.orgCount}</td>
                  <td className="px-4 py-3 text-center">
                    {rule.disabledByOrgs > 0 ? (
                      <span className="text-amber-600 font-medium">{rule.disabledByOrgs}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-500">No rules match your filters.</div>
        )}
      </div>
    </div>
  );
}
