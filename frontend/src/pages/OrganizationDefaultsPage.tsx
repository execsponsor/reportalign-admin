import { useState, useEffect } from 'react';
import {
  Settings2,
  Save,
  RotateCcw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Palette,
  ListOrdered,
  ArrowRightLeft,
  BookOpen,
  FolderTree,
  Eye,
  UserCog,
} from 'lucide-react';
import {
  useOrganizationDefaults,
  useUpdateOrganizationDefaults,
} from '../hooks/useOrganizationDefaults';

// ============================================================================
// Main page
// ============================================================================

export function OrganizationDefaultsPage() {
  const { data, isLoading, error } = useOrganizationDefaults();
  const updateMutation = useUpdateOrganizationDefaults();

  const [editedJson, setEditedJson] = useState<string>('');
  const [parseError, setParseError] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'structured' | 'json'>('structured');

  // Sync fetched data into editor
  useEffect(() => {
    if (data?.defaults) {
      setEditedJson(JSON.stringify(data.defaults, null, 2));
    }
  }, [data]);

  const handleJsonChange = (value: string) => {
    setEditedJson(value);
    setParseError('');
    try {
      JSON.parse(value);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  const handleReset = () => {
    if (data?.defaults) {
      setEditedJson(JSON.stringify(data.defaults, null, 2));
      setParseError('');
      setSaveError('');
    }
  };

  const handleSave = async () => {
    setSaveSuccess(false);
    setSaveError('');

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(editedJson);
    } catch {
      setSaveError('Cannot save — JSON is invalid');
      return;
    }

    try {
      await updateMutation.mutateAsync(parsed);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const hasChanges = data?.defaults
    ? editedJson !== JSON.stringify(data.defaults, null, 2)
    : false;

  const canSave = hasChanges && !parseError && !updateMutation.isPending;

  // Parse for structured view
  let parsedDefaults: Record<string, unknown> | null = null;
  try {
    parsedDefaults = JSON.parse(editedJson);
  } catch {
    // fall through — structured view will show error
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-admin-muted">
        <Loader2 className="h-6 w-6 animate-spin mr-3" />
        Loading defaults...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
        <p className="text-red-400">Failed to load organization defaults. Check API connection.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-admin-accent/20 flex items-center justify-center">
            <Settings2 className="h-5 w-5 text-admin-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Organization Defaults</h1>
            <p className="text-sm text-admin-muted">
              Default configuration applied when creating new organizations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="flex items-center gap-1 text-sm text-green-400">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
          {saveError && (
            <span className="text-sm text-red-400">{saveError}</span>
          )}
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="px-4 py-2 rounded-lg text-sm text-admin-muted hover:text-white hover:bg-admin-card border border-admin-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="h-4 w-4 inline mr-1" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-admin-accent hover:bg-admin-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 inline mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 inline mr-1" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-admin-accent/10 border border-admin-accent/30 rounded-xl p-4 mb-6">
        <p className="text-sm text-admin-text">
          These defaults are applied to <span className="text-admin-accent font-semibold">every new organization</span> at
          creation time. Changing these values will not affect existing organizations — only new ones created after saving.
        </p>
      </div>

      {/* Last updated info */}
      {data?.updated_at && (
        <div className="text-xs text-admin-muted mb-4">
          Last updated: {new Date(data.updated_at).toLocaleString()}
          {!data.is_from_database && ' (using hardcoded fallback — save to persist to database)'}
        </div>
      )}

      {/* View mode toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setViewMode('structured')}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            viewMode === 'structured'
              ? 'bg-admin-accent text-white'
              : 'text-admin-muted hover:text-white hover:bg-admin-card border border-admin-border'
          }`}
        >
          Structured View
        </button>
        <button
          onClick={() => setViewMode('json')}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            viewMode === 'json'
              ? 'bg-admin-accent text-white'
              : 'text-admin-muted hover:text-white hover:bg-admin-card border border-admin-border'
          }`}
        >
          Raw JSON
        </button>
      </div>

      {viewMode === 'structured' && parsedDefaults ? (
        <StructuredEditor
          defaults={parsedDefaults}
          activeSection={activeSection}
          onToggleSection={(s) => setActiveSection(activeSection === s ? null : s)}
          onChange={(updated) => {
            setEditedJson(JSON.stringify(updated, null, 2));
            setParseError('');
          }}
        />
      ) : (
        /* Raw JSON editor */
        <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-white">Configuration JSON</label>
            {parseError && (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <AlertTriangle className="h-3 w-3" />
                {parseError}
              </span>
            )}
          </div>
          <textarea
            value={editedJson}
            onChange={(e) => handleJsonChange(e.target.value)}
            rows={35}
            spellCheck={false}
            className={`w-full bg-admin-bg border rounded-lg px-4 py-3 text-sm text-admin-text font-mono focus:outline-none focus:ring-2 resize-y ${
              parseError
                ? 'border-red-500/50 focus:ring-red-500/50'
                : 'border-admin-border focus:ring-admin-accent/50'
            }`}
          />
          <div className="flex justify-between text-xs text-admin-muted mt-1">
            <span>{editedJson.length} characters</span>
            <span>{parseError ? 'Fix JSON errors before saving' : 'Valid JSON'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Structured editor — collapsible sections for each part of the defaults
// ============================================================================

const SECTIONS = [
  { key: 'organization_settings', label: 'Organization Settings', icon: BookOpen, description: 'Terminology, RAG definitions, framework, fiscal year, visibility' },
  { key: 'admin_primary_role', label: 'Admin Primary Role', icon: UserCog, description: 'Default primary role assigned to the org admin user' },
  { key: 'portfolio_grouping', label: 'Portfolio Grouping', icon: FolderTree, description: 'Division/department hierarchy defaults' },
  { key: 'primary_brand_color', label: 'Brand Color', icon: Palette, description: 'Default primary brand color for new organizations' },
  { key: 'workflow_steps', label: 'Workflow Steps', icon: ListOrdered, description: 'Default report workflow stages' },
  { key: 'workflow_transitions', label: 'Workflow Transitions', icon: ArrowRightLeft, description: 'Allowed transitions between workflow steps' },
];

function StructuredEditor({
  defaults,
  activeSection,
  onToggleSection,
  onChange,
}: {
  defaults: Record<string, unknown>;
  activeSection: string | null;
  onToggleSection: (key: string) => void;
  onChange: (updated: Record<string, unknown>) => void;
}) {
  const updateSection = (key: string, value: unknown) => {
    onChange({ ...defaults, [key]: value });
  };

  return (
    <div className="space-y-3">
      {SECTIONS.map((section) => {
        const isOpen = activeSection === section.key;
        const Icon = section.icon;
        const sectionValue = defaults[section.key];

        return (
          <div
            key={section.key}
            className="bg-admin-surface border border-admin-border rounded-xl overflow-hidden"
          >
            {/* Section header */}
            <button
              onClick={() => onToggleSection(section.key)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-admin-card/50 transition-colors"
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-admin-muted shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-admin-muted shrink-0" />
              )}
              <div className="w-8 h-8 rounded-lg bg-admin-card flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-admin-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">{section.label}</h3>
                <p className="text-xs text-admin-muted">{section.description}</p>
              </div>
              {/* Preview chip */}
              <span className="text-xs text-admin-muted bg-admin-card px-2 py-0.5 rounded-full shrink-0">
                {section.key === 'primary_brand_color' ? (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-full inline-block border border-admin-border"
                      style={{ backgroundColor: sectionValue as string }}
                    />
                    {sectionValue as string}
                  </span>
                ) : section.key === 'admin_primary_role' ? (
                  sectionValue as string
                ) : Array.isArray(sectionValue) ? (
                  `${sectionValue.length} items`
                ) : (
                  `${Object.keys(sectionValue as Record<string, unknown>).length} fields`
                )}
              </span>
            </button>

            {/* Section body */}
            {isOpen && (
              <div className="px-5 pb-5 border-t border-admin-border pt-4">
                {section.key === 'primary_brand_color' ? (
                  <BrandColorEditor
                    value={sectionValue as string}
                    onChange={(v) => updateSection(section.key, v)}
                  />
                ) : section.key === 'organization_settings' ? (
                  <OrgSettingsEditor
                    value={sectionValue as Record<string, unknown>}
                    onChange={(v) => updateSection(section.key, v)}
                  />
                ) : section.key === 'admin_primary_role' ? (
                  <AdminPrimaryRoleEditor
                    value={sectionValue as string}
                    onChange={(v) => updateSection(section.key, v)}
                  />
                ) : section.key === 'portfolio_grouping' ? (
                  <PortfolioGroupingEditor
                    value={sectionValue as Record<string, unknown>}
                    onChange={(v) => updateSection(section.key, v)}
                  />
                ) : (
                  /* Workflow steps and transitions — JSON textarea for these complex arrays */
                  <SectionJsonEditor
                    value={sectionValue}
                    onChange={(v) => updateSection(section.key, v)}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Section-specific editors
// ============================================================================

function BrandColorEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-4">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-12 h-10 rounded cursor-pointer bg-transparent border border-admin-border"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#1E40AF"
        className="w-40 bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text font-mono focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
      />
      <span className="text-xs text-admin-muted">
        This colour is used as the primary brand colour for newly created organizations.
      </span>
    </div>
  );
}

function AdminPrimaryRoleEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-admin-muted mb-2">
        The primary role assigned to the administrator user when a new organization is created.
      </label>
      <select
        value={value || 'executive'}
        onChange={(e) => onChange(e.target.value)}
        className="w-64 bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
      >
        <option value="executive">Executive</option>
        <option value="pmo">PMO</option>
        <option value="programme_manager">Programme Manager</option>
        <option value="project_manager">Project Manager</option>
      </select>
    </div>
  );
}

const FEATURE_TOGGLES = [
  { key: 'strategic_goals_enabled', label: 'Strategic Goals' },
  { key: 'milestones_enabled', label: 'Milestones' },
  { key: 'workstreams_enabled', label: 'Workstreams' },
  { key: 'business_case_enabled', label: 'Business Case' },
  { key: 'risk_issue_register_enabled', label: 'Risk & Issue Register' },
  { key: 'action_tracking_enabled', label: 'Action Tracking' },
  { key: 'meeting_management_enabled', label: 'Meeting Management' },
  { key: 'assurance_enabled', label: 'Programme Assurance' },
  { key: 'communications_enabled', label: 'Communications' },
  { key: 'briefings_enabled', label: 'Briefings' },
  { key: 'knowledge_hub_enabled', label: 'Knowledge Hub' },
  { key: 'community_hub_enabled', label: 'Community Hub' },
];

function OrgSettingsEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const terminology = (value.terminology_config || {}) as Record<string, string>;
  const ragDefs = (value.rag_definitions || {}) as Record<string, { label: string; description: string }>;
  const framework = (value.outcome_framework || '') as string;
  const fiscalMonth = (value.fiscal_year_start_month || 4) as number;
  const visibilityMode = (value.user_visibility_mode || 'all') as string;
  const authorCanCreate = (value.author_can_create_programmes || false) as boolean;
  const funcVisibility = (value.functionality_visibility || {}) as Record<string, boolean>;

  const updateTerminology = (key: string, val: string) => {
    onChange({ ...value, terminology_config: { ...terminology, [key]: val } });
  };

  const updateRag = (colour: string, field: 'label' | 'description', val: string) => {
    onChange({
      ...value,
      rag_definitions: {
        ...ragDefs,
        [colour]: { ...ragDefs[colour], [field]: val },
      },
    });
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <div className="space-y-6">
      {/* Terminology */}
      <div>
        <h4 className="text-sm font-semibold text-white mb-3">Terminology</h4>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(terminology).map(([key, val]) => (
            <div key={key}>
              <label className="block text-xs text-admin-muted mb-1 capitalize">{key}</label>
              <input
                type="text"
                value={val}
                onChange={(e) => updateTerminology(key, e.target.value)}
                className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
              />
            </div>
          ))}
        </div>
      </div>

      {/* RAG Definitions */}
      <div>
        <h4 className="text-sm font-semibold text-white mb-3">RAG Status Definitions</h4>
        <div className="space-y-3">
          {Object.entries(ragDefs).map(([colour, def]) => {
            const dotColour = colour === 'red' ? 'bg-red-500' : colour === 'amber' ? 'bg-yellow-500' : 'bg-green-500';
            return (
              <div key={colour} className="flex items-start gap-3 bg-admin-card border border-admin-border rounded-lg p-3">
                <span className={`w-3 h-3 rounded-full mt-2 shrink-0 ${dotColour}`} />
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-admin-muted mb-1">Label</label>
                    <input
                      type="text"
                      value={def.label}
                      onChange={(e) => updateRag(colour, 'label', e.target.value)}
                      className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-admin-muted mb-1">Description</label>
                    <input
                      type="text"
                      value={def.description}
                      onChange={(e) => updateRag(colour, 'description', e.target.value)}
                      className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Outcome Framework + Fiscal Year */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-admin-muted mb-1">Outcome Framework</label>
          <input
            type="text"
            value={framework}
            onChange={(e) => onChange({ ...value, outcome_framework: e.target.value })}
            className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
          />
        </div>
        <div>
          <label className="block text-xs text-admin-muted mb-1">Fiscal Year Start Month</label>
          <select
            value={fiscalMonth}
            onChange={(e) => onChange({ ...value, fiscal_year_start_month: parseInt(e.target.value) })}
            className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
          >
            {monthNames.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Visibility Settings */}
      <div>
        <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Eye className="h-4 w-4 text-admin-accent" />
          Visibility Settings
        </h4>

        {/* Content Visibility Mode */}
        <div className="mb-4">
          <label className="block text-xs text-admin-muted mb-2">Content Visibility Mode</label>
          <div className="flex gap-4">
            {(['all', 'assigned_only'] as const).map((mode) => (
              <label key={mode} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="visibility_mode"
                  checked={visibilityMode === mode}
                  onChange={() => onChange({ ...value, user_visibility_mode: mode })}
                  className="accent-admin-accent"
                />
                <span className="text-sm text-admin-text">
                  {mode === 'all' ? 'All programmes visible to all users' : 'Only assigned programmes visible'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Author Can Create */}
        <div className="mb-4">
          <ToggleField
            label="Allow Authors to create programmes"
            checked={authorCanCreate}
            onChange={(v) => onChange({ ...value, author_can_create_programmes: v })}
          />
        </div>

        {/* Feature Toggles */}
        <label className="block text-xs text-admin-muted mb-2">Feature Visibility Toggles</label>
        <div className="grid grid-cols-2 gap-3">
          {FEATURE_TOGGLES.map((feat) => (
            <div key={feat.key} className="bg-admin-card border border-admin-border rounded-lg px-3 py-2.5">
              <ToggleField
                label={feat.label}
                checked={funcVisibility[feat.key] ?? false}
                onChange={(v) =>
                  onChange({
                    ...value,
                    functionality_visibility: { ...funcVisibility, [feat.key]: v },
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PortfolioGroupingEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <ToggleField
        label="Portfolio Grouping Enabled"
        checked={value.grouping_enabled as boolean}
        onChange={(v) => onChange({ ...value, grouping_enabled: v })}
      />
      <div className="grid grid-cols-2 gap-4 pl-6">
        <div className="space-y-3">
          <ToggleField
            label="Level 1 Enabled"
            checked={value.level_1_enabled as boolean}
            onChange={(v) => onChange({ ...value, level_1_enabled: v })}
          />
          <div>
            <label className="block text-xs text-admin-muted mb-1">Level 1 Name</label>
            <input
              type="text"
              value={value.level_1_name as string}
              onChange={(e) => onChange({ ...value, level_1_name: e.target.value })}
              className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
            />
          </div>
        </div>
        <div className="space-y-3">
          <ToggleField
            label="Level 2 Enabled"
            checked={value.level_2_enabled as boolean}
            onChange={(v) => onChange({ ...value, level_2_enabled: v })}
          />
          <div>
            <label className="block text-xs text-admin-muted mb-1">Level 2 Name</label>
            <input
              type="text"
              value={value.level_2_name as string}
              onChange={(e) => onChange({ ...value, level_2_name: e.target.value })}
              className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => e.key === 'Enter' && onChange(!checked)}
        className={`w-10 h-5 rounded-full relative transition-colors ${
          checked ? 'bg-admin-accent' : 'bg-admin-card border border-admin-border'
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </div>
      <span className="text-sm text-admin-text">{label}</span>
    </label>
  );
}

function SectionJsonEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState('');

  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
  }, [value]);

  const handleChange = (newText: string) => {
    setText(newText);
    setError('');
    try {
      const parsed = JSON.parse(newText);
      onChange(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  return (
    <div>
      {error && (
        <div className="flex items-center gap-1 text-xs text-red-400 mb-2">
          <AlertTriangle className="h-3 w-3" />
          {error}
        </div>
      )}
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        rows={Math.min(20, text.split('\n').length + 2)}
        spellCheck={false}
        className={`w-full bg-admin-bg border rounded-lg px-4 py-3 text-sm text-admin-text font-mono focus:outline-none focus:ring-2 resize-y ${
          error
            ? 'border-red-500/50 focus:ring-red-500/50'
            : 'border-admin-border focus:ring-admin-accent/50'
        }`}
      />
    </div>
  );
}
