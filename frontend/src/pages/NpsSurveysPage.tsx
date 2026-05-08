import { useState } from 'react';
import { SmilePlus, Loader2, TrendingUp, TrendingDown, Minus, ArrowLeft, MessageSquare } from 'lucide-react';
import { useNpsSurveys, useNpsOrgDetail } from '../hooks/useNpsSurveys';

function getNpsColor(score: number): string {
  if (score >= 50) return 'text-emerald-400';
  if (score >= 0) return 'text-amber-400';
  return 'text-red-400';
}

function getNpsIcon(score: number) {
  if (score >= 50) return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (score >= 0) return <Minus className="h-4 w-4 text-amber-400" />;
  return <TrendingDown className="h-4 w-4 text-red-400" />;
}

function getScoreBadgeColor(score: number): string {
  if (score <= 6) return 'bg-red-500/20 text-red-400';
  if (score <= 8) return 'bg-amber-500/20 text-amber-400';
  return 'bg-emerald-500/20 text-emerald-400';
}

export function NpsSurveysPage() {
  const { data, isLoading } = useNpsSurveys();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const { data: orgDetail, isLoading: orgLoading } = useNpsOrgDetail(selectedOrgId);

  if (selectedOrgId && orgDetail) {
    return (
      <div>
        <button
          onClick={() => setSelectedOrgId(null)}
          className="flex items-center gap-2 text-admin-muted hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to overview
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <SmilePlus className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{orgDetail.organization.name}</h1>
            <p className="text-sm text-admin-muted">NPS Detail - {orgDetail.organization.subdomain}</p>
          </div>
        </div>

        {/* Org stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <p className="text-xs text-admin-muted uppercase tracking-wider">NPS Score</p>
            <p className={`text-3xl font-bold mt-1 ${getNpsColor(orgDetail.stats.npsScore)}`}>
              {orgDetail.stats.npsScore}
            </p>
          </div>
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <p className="text-xs text-admin-muted uppercase tracking-wider">Responses</p>
            <p className="text-3xl font-bold text-white mt-1">{orgDetail.stats.totalResponses}</p>
          </div>
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <p className="text-xs text-admin-muted uppercase tracking-wider">Avg Score</p>
            <p className="text-3xl font-bold text-white mt-1">{orgDetail.stats.avgScore}</p>
          </div>
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <p className="text-xs text-admin-muted uppercase tracking-wider">Breakdown</p>
            <div className="flex gap-3 mt-2">
              <span className="text-emerald-400 text-sm font-medium">{orgDetail.stats.promoters}P</span>
              <span className="text-amber-400 text-sm font-medium">{orgDetail.stats.passives}N</span>
              <span className="text-red-400 text-sm font-medium">{orgDetail.stats.detractors}D</span>
            </div>
          </div>
        </div>

        {/* Monthly trend */}
        {orgDetail.trend.length > 0 && (
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-white mb-4">Monthly Trend</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {orgDetail.trend.map((t) => (
                <div key={t.month} className="text-center p-3 rounded-lg bg-admin-card">
                  <p className="text-xs text-admin-muted">{t.month}</p>
                  <p className={`text-lg font-bold ${getNpsColor(t.npsScore)}`}>{t.npsScore}</p>
                  <p className="text-xs text-admin-muted">{t.responseCount} resp</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Individual responses */}
        <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Responses ({orgDetail.responses.length})</h3>
          <div className="space-y-3">
            {orgDetail.responses.map((r) => (
              <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg bg-admin-card">
                <span className={`px-2 py-1 rounded text-xs font-bold ${getScoreBadgeColor(r.score)}`}>
                  {r.score}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">
                    {r.firstName} {r.lastName}
                    <span className="text-admin-muted ml-2 text-xs">{r.email}</span>
                  </p>
                  {r.feedbackText && (
                    <p className="text-sm text-admin-muted mt-1 italic">"{r.feedbackText}"</p>
                  )}
                </div>
                <span className="text-xs text-admin-muted whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
            {orgDetail.responses.length === 0 && (
              <p className="text-sm text-admin-muted">No responses yet</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <SmilePlus className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">NPS Surveys</h1>
            <p className="text-sm text-admin-muted">Net Promoter Score across all organisations</p>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-admin-muted">
          <Loader2 className="h-6 w-6 animate-spin mr-3" />Loading...
        </div>
      )}

      {orgLoading && (
        <div className="flex items-center justify-center py-20 text-admin-muted">
          <Loader2 className="h-6 w-6 animate-spin mr-3" />Loading org detail...
        </div>
      )}

      {data && (
        <>
          {/* Platform stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <p className="text-xs text-admin-muted uppercase tracking-wider">Platform NPS</p>
              <div className="flex items-center gap-2 mt-1">
                <p className={`text-3xl font-bold ${getNpsColor(data.platform.npsScore)}`}>
                  {data.platform.npsScore}
                </p>
                {getNpsIcon(data.platform.npsScore)}
              </div>
            </div>
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <p className="text-xs text-admin-muted uppercase tracking-wider">Total Responses</p>
              <p className="text-3xl font-bold text-white mt-1">{data.platform.totalResponses}</p>
            </div>
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <p className="text-xs text-admin-muted uppercase tracking-wider">Avg Score</p>
              <p className="text-3xl font-bold text-white mt-1">{data.platform.avgScore}</p>
            </div>
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <p className="text-xs text-admin-muted uppercase tracking-wider">Promoters</p>
              <p className="text-3xl font-bold text-emerald-400 mt-1">{data.platform.promoters}</p>
            </div>
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <p className="text-xs text-admin-muted uppercase tracking-wider">Detractors</p>
              <p className="text-3xl font-bold text-red-400 mt-1">{data.platform.detractors}</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Per-org table */}
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">NPS by Organisation</h3>
              <div className="space-y-2">
                {data.byOrg.length === 0 && <p className="text-sm text-admin-muted">No data yet</p>}
                {data.byOrg.map((org) => (
                  <button
                    key={org.orgId}
                    onClick={() => setSelectedOrgId(org.orgId)}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-admin-card hover:bg-admin-card/80 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{org.orgName}</p>
                      <p className="text-xs text-admin-muted">{org.responseCount} responses</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${getNpsColor(org.npsScore)}`}>{org.npsScore}</p>
                      <p className="text-xs text-admin-muted">avg {org.avgScore}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Trend */}
            <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Monthly Trend</h3>
              {data.trend.length === 0 && <p className="text-sm text-admin-muted">No data yet</p>}
              <div className="space-y-2">
                {data.trend.map((t) => (
                  <div key={t.month} className="flex items-center justify-between p-3 rounded-lg bg-admin-card">
                    <div>
                      <p className="text-sm font-medium text-white">{t.month}</p>
                      <p className="text-xs text-admin-muted">{t.responseCount} responses</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${getNpsColor(t.npsScore)}`}>{t.npsScore}</span>
                      {getNpsIcon(t.npsScore)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Latest verbatim feedback */}
          <div className="bg-admin-surface border border-admin-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-4 w-4 text-admin-muted" />
              <h3 className="text-sm font-semibold text-white">Latest Feedback</h3>
            </div>
            {data.latestFeedback.length === 0 && (
              <p className="text-sm text-admin-muted">No feedback yet</p>
            )}
            <div className="space-y-3">
              {data.latestFeedback.map((fb, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-admin-card">
                  <span className={`px-2 py-1 rounded text-xs font-bold shrink-0 ${getScoreBadgeColor(fb.score)}`}>
                    {fb.score}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white italic">"{fb.feedbackText}"</p>
                    <p className="text-xs text-admin-muted mt-1">
                      {fb.firstName} {fb.lastName} - {fb.orgName}
                      <span className="ml-2">{new Date(fb.createdAt).toLocaleDateString()}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
