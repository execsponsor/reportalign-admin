import { useState } from 'react';
import {
  Sparkles,
  Pen,
  Maximize,
  Minimize,
  Briefcase,
  FileText,
  AlertTriangle,
  Activity,
  Users,
  MessageSquare,
  Save,
  X,
  ChevronLeft,
  Building2,
  Loader2,
} from 'lucide-react';
import {
  useAIPromptTemplates,
  useAIPromptTemplate,
  useUpdateAIPromptTemplate,
  type AIPromptTemplate,
} from '../hooks/useAIPromptTemplates';

// ============================================================================
// Template metadata
// ============================================================================

const TEMPLATE_META: Record<string, { icon: typeof Pen; label: string; description: string }> = {
  improve: { icon: Pen, label: 'Professional Writing', description: 'Polish text for professional executive reports' },
  expand: { icon: Maximize, label: 'Add Detail', description: 'Expand brief notes with relevant context' },
  summarize: { icon: Minimize, label: 'Summarize', description: 'Condense content to key executive points' },
  formalize: { icon: Briefcase, label: 'Formalize', description: 'Make language more formal and business-appropriate' },
  executive_summary: { icon: FileText, label: 'Executive Summary', description: 'Generate programme overview for executives' },
  risk_analysis: { icon: AlertTriangle, label: 'Risk Analysis', description: 'Enhance risk descriptions with impact analysis' },
  status_narrative: { icon: Activity, label: 'Status Narrative', description: 'Convert RAG status to clear narrative' },
  recommendation: { icon: Sparkles, label: 'Recommendation', description: 'Generate actionable recommendations' },
  board_brief: { icon: Users, label: 'Board Brief', description: 'Ultra-concise board-level summaries' },
};

// ============================================================================
// Main page
// ============================================================================

export function AIPromptTemplatesPage() {
  const { data, isLoading, error } = useAIPromptTemplates();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const templates = data?.templates ?? [];

  if (selectedKey) {
    return <TemplateEditor templateKey={selectedKey} onBack={() => setSelectedKey(null)} />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-admin-accent/20 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-admin-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">AI Prompt Templates</h1>
          <p className="text-sm text-admin-muted">
            Manage platform-wide default prompts that power all AI features
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-admin-accent/10 border border-admin-accent/30 rounded-xl p-4 mb-6">
        <p className="text-sm text-admin-text">
          These are the <span className="text-admin-accent font-semibold">system defaults</span> used
          by all organisations. Changes here affect every org that hasn't created their own override.
          Organisations with custom overrides are unaffected.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-admin-muted">
          <Loader2 className="h-6 w-6 animate-spin mr-3" />
          Loading templates...
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400">Failed to load templates. Check API connection.</p>
        </div>
      )}

      {/* Template cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <TemplateCard
            key={template.template_key}
            template={template}
            onEdit={() => setSelectedKey(template.template_key)}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Template card
// ============================================================================

function TemplateCard({
  template,
  onEdit,
}: {
  template: AIPromptTemplate;
  onEdit: () => void;
}) {
  const meta = TEMPLATE_META[template.template_key] || {
    icon: MessageSquare,
    label: template.display_name,
    description: template.description || '',
  };
  const Icon = meta.icon;

  return (
    <div className="bg-admin-surface border border-admin-border rounded-xl p-5 hover:border-admin-accent/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-admin-card flex items-center justify-center">
            <Icon className="h-4 w-4 text-admin-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{meta.label}</h3>
            <p className="text-xs text-admin-muted">{template.template_key}</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-admin-muted mb-4 line-clamp-2">{meta.description}</p>

      {/* Settings summary */}
      <div className="flex flex-wrap gap-2 mb-4">
        {template.tone && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-admin-card text-admin-muted border border-admin-border">
            {template.tone}
          </span>
        )}
        {template.target_audience && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-admin-card text-admin-muted border border-admin-border">
            {template.target_audience}
          </span>
        )}
        <span className="text-xs px-2 py-0.5 rounded-full bg-admin-card text-admin-muted border border-admin-border">
          temp: {Number(template.temperature).toFixed(1)}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-admin-card text-admin-muted border border-admin-border">
          {template.max_output_tokens} tokens
        </span>
      </div>

      {/* Override count + edit */}
      <div className="flex items-center justify-between">
        {template.override_count > 0 ? (
          <span className="text-xs text-yellow-400">
            <Building2 className="h-3 w-3 inline mr-1" />
            {template.override_count} org{template.override_count !== 1 ? 's' : ''} customised
          </span>
        ) : (
          <span className="text-xs text-admin-muted">No org overrides</span>
        )}
        <button
          onClick={onEdit}
          className="text-xs font-medium text-admin-accent hover:text-admin-accent-hover transition-colors"
        >
          Edit →
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Template editor (detail view)
// ============================================================================

function TemplateEditor({
  templateKey,
  onBack,
}: {
  templateKey: string;
  onBack: () => void;
}) {
  const { data, isLoading } = useAIPromptTemplate(templateKey);
  const updateMutation = useUpdateAIPromptTemplate();

  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [userPromptTemplate, setUserPromptTemplate] = useState<string | null>(null);
  const [tone, setTone] = useState<string | null>(null);
  const [targetAudience, setTargetAudience] = useState<string | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [maxOutputTokens, setMaxOutputTokens] = useState<number | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  const template = data?.template;
  const overrides = data?.overrides ?? [];

  // Use local state if edited, otherwise use fetched data
  const currentSystemPrompt = systemPrompt ?? template?.system_prompt ?? '';
  const currentUserPromptTemplate = userPromptTemplate ?? template?.user_prompt_template ?? '';
  const currentTone = tone ?? template?.tone ?? '';
  const currentTargetAudience = targetAudience ?? template?.target_audience ?? '';
  const currentTemperature = temperature ?? Number(template?.temperature) ?? 0.7;
  const currentMaxTokens = maxOutputTokens ?? template?.max_output_tokens ?? 1000;

  const hasChanges =
    systemPrompt !== null ||
    userPromptTemplate !== null ||
    tone !== null ||
    targetAudience !== null ||
    temperature !== null ||
    maxOutputTokens !== null;

  const handleSave = async () => {
    setSaveSuccess(false);
    setSaveError('');

    const updates: Record<string, unknown> = {};
    if (systemPrompt !== null) updates.system_prompt = systemPrompt;
    if (userPromptTemplate !== null) updates.user_prompt_template = userPromptTemplate;
    if (tone !== null) updates.tone = tone || null;
    if (targetAudience !== null) updates.target_audience = targetAudience || null;
    if (temperature !== null) updates.temperature = temperature;
    if (maxOutputTokens !== null) updates.max_output_tokens = maxOutputTokens;

    try {
      await updateMutation.mutateAsync({ templateKey, updates });
      setSaveSuccess(true);
      // Reset local edits so hasChanges becomes false
      setSystemPrompt(null);
      setUserPromptTemplate(null);
      setTone(null);
      setTargetAudience(null);
      setTemperature(null);
      setMaxOutputTokens(null);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const meta = TEMPLATE_META[templateKey];

  if (isLoading || !template) {
    return (
      <div className="flex items-center justify-center py-20 text-admin-muted">
        <Loader2 className="h-6 w-6 animate-spin mr-3" />
        Loading template...
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg text-admin-muted hover:text-white hover:bg-admin-card transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{meta?.label || template.display_name}</h1>
            <p className="text-sm text-admin-muted">{templateKey}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="text-sm text-green-400">Saved successfully</span>
          )}
          {saveError && (
            <span className="text-sm text-red-400">{saveError}</span>
          )}
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg text-sm text-admin-muted hover:text-white hover:bg-admin-card border border-admin-border transition-colors"
          >
            <X className="h-4 w-4 inline mr-1" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main editor (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* System Prompt */}
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <label className="block text-sm font-semibold text-white mb-1">System Prompt</label>
            <p className="text-xs text-admin-muted mb-3">
              Core behavioural instructions for the AI. This is the main lever for controlling output quality and style.
            </p>
            <textarea
              value={currentSystemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={16}
              className="w-full bg-admin-bg border border-admin-border rounded-lg px-4 py-3 text-sm text-admin-text font-mono focus:outline-none focus:ring-2 focus:ring-admin-accent/50 resize-y"
            />
            <div className="text-xs text-admin-muted text-right mt-1">
              {currentSystemPrompt.length} characters
            </div>
          </div>

          {/* User Prompt Template */}
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <label className="block text-sm font-semibold text-white mb-1">User Prompt Template</label>
            <p className="text-xs text-admin-muted mb-3">
              Template for user input. Use <code className="bg-admin-card px-1 rounded">{'{{text}}'}</code> for
              the content to process. Other variables: <code className="bg-admin-card px-1 rounded">{'{{organization_name}}'}</code>,{' '}
              <code className="bg-admin-card px-1 rounded">{'{{programme_term}}'}</code>,{' '}
              <code className="bg-admin-card px-1 rounded">{'{{current_date}}'}</code>
            </p>
            <textarea
              value={currentUserPromptTemplate}
              onChange={(e) => setUserPromptTemplate(e.target.value)}
              rows={4}
              className="w-full bg-admin-bg border border-admin-border rounded-lg px-4 py-3 text-sm text-admin-text font-mono focus:outline-none focus:ring-2 focus:ring-admin-accent/50 resize-y"
            />
          </div>

          {/* Org overrides */}
          {overrides.length > 0 && (
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-1">Organisation Overrides</h3>
              <p className="text-xs text-admin-muted mb-4">
                These organisations have customised this template. Your changes to the default won't affect them.
              </p>
              <div className="space-y-2">
                {overrides.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between bg-admin-card border border-admin-border rounded-lg px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">{o.organization_name}</p>
                      <p className="text-xs text-admin-muted">{o.subdomain}.execsponsor.com</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-admin-muted">
                      {o.tone && <span className="px-2 py-0.5 rounded-full bg-admin-surface">{o.tone}</span>}
                      <span>temp: {Number(o.temperature).toFixed(1)}</span>
                      <span>Updated {new Date(o.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Settings sidebar (1 col) */}
        <div className="space-y-6">
          {/* Tone */}
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <label className="block text-sm font-semibold text-white mb-3">Tone</label>
            <select
              value={currentTone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
            >
              <option value="">Not set</option>
              <option value="formal">Formal</option>
              <option value="conversational">Conversational</option>
              <option value="technical">Technical</option>
              <option value="executive">Executive</option>
            </select>
          </div>

          {/* Target Audience */}
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <label className="block text-sm font-semibold text-white mb-3">Target Audience</label>
            <select
              value={currentTargetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
            >
              <option value="">Not set</option>
              <option value="board">Board</option>
              <option value="executives">Executives</option>
              <option value="stakeholders">Stakeholders</option>
              <option value="team">Team</option>
            </select>
          </div>

          {/* Temperature */}
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <label className="block text-sm font-semibold text-white mb-1">Temperature</label>
            <p className="text-xs text-admin-muted mb-3">
              Lower = more consistent. Higher = more creative.
            </p>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={currentTemperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-admin-accent"
            />
            <div className="flex justify-between text-xs text-admin-muted mt-1">
              <span>Precise (0)</span>
              <span className="text-admin-accent font-semibold">{currentTemperature.toFixed(1)}</span>
              <span>Creative (2)</span>
            </div>
          </div>

          {/* Max Output Tokens */}
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <label className="block text-sm font-semibold text-white mb-1">Max Output Tokens</label>
            <p className="text-xs text-admin-muted mb-3">
              Maximum length of AI response (100–4000)
            </p>
            <input
              type="number"
              min={100}
              max={4000}
              value={currentMaxTokens}
              onChange={(e) => setMaxOutputTokens(parseInt(e.target.value) || 1000)}
              className="w-full bg-admin-bg border border-admin-border rounded-lg px-3 py-2 text-sm text-admin-text focus:outline-none focus:ring-2 focus:ring-admin-accent/50"
            />
          </div>

          {/* Template info */}
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Info</h3>
            <div className="space-y-2 text-xs text-admin-muted">
              <div className="flex justify-between">
                <span>Created</span>
                <span className="text-admin-text">{new Date(template.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Last updated</span>
                <span className="text-admin-text">{new Date(template.updated_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Org overrides</span>
                <span className="text-admin-text">{overrides.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
