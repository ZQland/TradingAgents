import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { StructuredOutput, Metadata, ResearchManager, Trader, Analysts, DebateData, PriceTargets, Probabilities } from '../types';
import TrendVisualization from './TrendVisualization';
import './Dashboard.css';

/* ────────────────────────────────────────────────────── */
/*  Utilities                                              */
/* ────────────────────────────────────────────────────── */

function safe(value: unknown, fallback = 'N/A'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function fmtPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return '\u2014';
  return `$${Number(value).toLocaleString()}`;
}

function badgeClass(decision: string): string {
  const d = (decision || '').toUpperCase();
  if (d === 'BUY') return 'badge-buy';
  if (d === 'SELL') return 'badge-sell';
  return 'badge-hold';
}

function confidenceColor(value: number): string {
  if (value >= 70) return '#3fb950';
  if (value >= 40) return '#d29922';
  return '#f85149';
}

function firstSentences(text: string | undefined | null, n = 2): string {
  if (!text) return '';
  const sentences = text.match(/[^.!?]*[.!?]+/g);
  if (!sentences) return text.slice(0, 200);
  return sentences.slice(0, n).join(' ').trim();
}

/* ────────────────────────────────────────────────────── */
/*  Sub-components                                         */
/* ────────────────────────────────────────────────────── */

interface ConfidenceGaugeProps {
  value: number | null;
}

function ConfidenceGauge({ value }: ConfidenceGaugeProps) {
  const clampedValue = value != null ? Math.max(0, Math.min(100, value)) : 0;
  const rotation = (clampedValue / 100) * 180 - 90;
  const color = value != null ? confidenceColor(value) : '#484f58';

  return (
    <div className="gauge-container">
      <div className="gauge-label">CONFIDENCE</div>
      <div className="gauge-arc-wrapper">
        <div className="gauge-arc-bg" />
        <div
          className="gauge-arc-fill"
          style={{
            background: `conic-gradient(
              ${color} 0deg,
              ${color} ${clampedValue * 1.8}deg,
              transparent ${clampedValue * 1.8}deg,
              transparent 180deg
            )`,
          }}
        />
        <div className="gauge-arc-mask" />
        <div className="gauge-needle" style={{ transform: `rotate(${rotation}deg)` }} />
        <div className="gauge-center-circle">
          <span className="gauge-value" style={{ color }}>
            {value != null ? `${value}%` : '\u2014'}
          </span>
        </div>
      </div>
      <div className="gauge-scale">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}

interface HeroHeaderProps {
  metadata: Metadata;
}

function HeroHeader({ metadata }: HeroHeaderProps) {
  const ticker = safe(metadata?.ticker, '\u2014');
  const date = safe(metadata?.trade_date, '\u2014');
  const decision = safe(metadata?.decision, '\u2014');
  const confidence = metadata?.confidence ?? null;

  return (
    <div className="hero-header">
      <div className="hero-left">
        <div className="hero-ticker">{ticker}</div>
        <div className="hero-meta-row">
          <span className="hero-date">{date}</span>
          <span className="hero-schema-badge">v1.0</span>
        </div>
      </div>

      <div className="hero-center">
        <div className="hero-decision-label">DECISION</div>
        <div className={`hero-decision-pill ${badgeClass(decision)}`}>
          {decision}
        </div>
      </div>

      <div className="hero-right">
        <ConfidenceGauge value={confidence} />
      </div>
    </div>
  );
}

interface ExecutiveSummaryCardProps {
  verdictMarkdown?: string;
}

function ExecutiveSummaryCard({ verdictMarkdown }: ExecutiveSummaryCardProps) {
  const summary = firstSentences(verdictMarkdown, 2);
  if (!summary) return null;

  return (
    <div className="card executive-summary-card">
      <h2 className="card-title">Executive Summary</h2>
      <p className="executive-summary-text">{summary}</p>
    </div>
  );
}

function PipelineVisualization() {
  const stages = [
    { label: 'Analysts', icon: '\uD83D\uDD0D' },
    { label: 'Debate', icon: '\u2694\uFE0F' },
    { label: 'Research Mgr', icon: '\uD83D\uDCCA' },
    { label: 'Trader', icon: '\uD83D\uDCB9' },
    { label: 'Risk Mgr', icon: '\uD83D\uDEE1\uFE0F' },
  ];

  return (
    <div className="card pipeline-card">
      <h2 className="card-title">Analysis Pipeline</h2>
      <div className="pipeline-flow">
        {stages.map((stage, i) => (
          <React.Fragment key={stage.label}>
            <div className="pipeline-node pipeline-node-complete">
              <div className="pipeline-node-circle">
                <span className="pipeline-check">{'\u2713'}</span>
              </div>
              <div className="pipeline-node-label">{stage.label}</div>
            </div>
            {i < stages.length - 1 && <div className="pipeline-connector" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

type Direction = 'up' | 'down' | 'neutral';

interface PriceTargetBoxProps {
  label: string;
  value: number | null | undefined;
  direction: Direction;
}

function PriceTargetBox({ label, value, direction }: PriceTargetBoxProps) {
  let tintClass = 'target-box-neutral';
  if (direction === 'up') tintClass = 'target-box-up';
  else if (direction === 'down') tintClass = 'target-box-down';

  return (
    <div className={`target-box ${tintClass}`}>
      <div className="target-box-label">{label}</div>
      <div className="target-box-value">{fmtPrice(value)}</div>
    </div>
  );
}

interface PriceTargetsCardProps {
  researchManager?: ResearchManager;
  trader?: Trader;
}

function PriceTargetsCard({ researchManager, trader }: PriceTargetsCardProps) {
  const rmTargets = researchManager?.price_targets;
  const trTargets = trader?.price_targets;

  function getDirection(targets: PriceTargets | null | undefined): Direction {
    if (!targets) return 'neutral';
    const d30 = targets.day_30;
    const d90 = targets.day_90;
    if (d30 == null || d90 == null) return 'neutral';
    if (d90 > d30) return 'up';
    if (d90 < d30) return 'down';
    return 'neutral';
  }

  const rmDir = getDirection(rmTargets);
  const trDir = getDirection(trTargets);

  return (
    <div className="card">
      <h2 className="card-title">Price Targets</h2>

      <div className="targets-source-label">Research Manager</div>
      <div className="targets-row">
        <PriceTargetBox label="30-Day" value={rmTargets?.day_30} direction={rmDir} />
        <PriceTargetBox label="60-Day" value={rmTargets?.day_60} direction={rmDir} />
        <PriceTargetBox label="90-Day" value={rmTargets?.day_90} direction={rmDir} />
      </div>

      <div className="targets-source-label" style={{ marginTop: 20 }}>Trader</div>
      <div className="targets-row">
        <PriceTargetBox label="30-Day" value={trTargets?.day_30} direction={trDir} />
        <PriceTargetBox label="60-Day" value={trTargets?.day_60} direction={trDir} />
        <PriceTargetBox label="90-Day" value={trTargets?.day_90} direction={trDir} />
      </div>
    </div>
  );
}

interface ProbabilityBarProps {
  label: string;
  probabilities?: Probabilities | null;
}

function ProbabilityBar({ label, probabilities }: ProbabilityBarProps) {
  const bull = probabilities?.bull ?? 0;
  const base = probabilities?.base ?? 0;
  const bear = probabilities?.bear ?? 0;
  const total = bull + base + bear;

  const pBull = total > 0 ? (bull / total) * 100 : 0;
  const pBase = total > 0 ? (base / total) * 100 : 0;
  const pBear = total > 0 ? (bear / total) * 100 : 0;

  return (
    <div className="prob-section">
      <div className="prob-source-label">{label}</div>
      <div className="prob-bar-container">
        {pBull > 0 && (
          <div
            className="prob-segment prob-segment-bull"
            style={{ width: `${pBull}%` }}
          >
            <span className="prob-segment-label">Bull {bull}%</span>
          </div>
        )}
        {pBase > 0 && (
          <div
            className="prob-segment prob-segment-base"
            style={{ width: `${pBase}%` }}
          >
            <span className="prob-segment-label">Base {base}%</span>
          </div>
        )}
        {pBear > 0 && (
          <div
            className="prob-segment prob-segment-bear"
            style={{ width: `${pBear}%` }}
          >
            <span className="prob-segment-label">Bear {bear}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface ScenarioProbabilitiesCardProps {
  researchManager?: ResearchManager;
  trader?: Trader;
}

function ScenarioProbabilitiesCard({ researchManager, trader }: ScenarioProbabilitiesCardProps) {
  return (
    <div className="card">
      <h2 className="card-title">Scenario Probabilities</h2>

      <ProbabilityBar
        label="Research Manager"
        probabilities={researchManager?.probabilities}
      />
      <ProbabilityBar
        label="Trader"
        probabilities={trader?.probabilities}
      />

      <div className="prob-legend">
        <div className="prob-legend-item">
          <span className="prob-legend-dot prob-legend-dot-bull" />
          Bull
        </div>
        <div className="prob-legend-item">
          <span className="prob-legend-dot prob-legend-dot-base" />
          Base
        </div>
        <div className="prob-legend-item">
          <span className="prob-legend-dot prob-legend-dot-bear" />
          Bear
        </div>
      </div>
    </div>
  );
}

interface RiskCardProps {
  researchManager?: ResearchManager;
  trader?: Trader;
}

function RiskCard({ researchManager, trader }: RiskCardProps) {
  const stopLoss = researchManager?.stop_loss ?? trader?.stop_loss;
  const thesisInvalidation = safe(researchManager?.thesis_invalidation);
  const positionSizing = safe(trader?.position_sizing);
  const reversalConditions = safe(trader?.reversal_conditions);

  return (
    <div className="card dashboard-grid-full">
      <h2 className="card-title">Risk Management</h2>

      <div className="risk-layout">
        <div className="risk-stop-loss">
          <div className="risk-stop-loss-label">Stop-Loss Level</div>
          <div className="risk-stop-loss-value">{fmtPrice(stopLoss)}</div>
        </div>

        <div className="risk-invalidation-callout">
          <div className="risk-invalidation-header">
            <span className="risk-warning-icon">{'\u26A0'}</span>
            <span>Thesis Invalidation</span>
          </div>
          <div className="risk-invalidation-text">{thesisInvalidation}</div>
        </div>

        <div className="risk-subcards">
          <div className="risk-subcard">
            <div className="risk-subcard-label">Position Sizing</div>
            <div className="risk-subcard-value">{positionSizing}</div>
          </div>
          <div className="risk-subcard">
            <div className="risk-subcard-label">Reversal Conditions</div>
            <div className="risk-subcard-value">{reversalConditions}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DebateCardProps {
  debate?: DebateData;
}

function DebateCard({ debate }: DebateCardProps) {
  const [expanded, setExpanded] = useState(false);
  const bullOpening = debate?.bull_opening || '';
  const bearOpening = debate?.bear_opening || '';
  const hasDebate = bullOpening.length > 20 || bearOpening.length > 20;

  if (!hasDebate) return null;

  return (
    <div className="card dashboard-grid-full">
      <h2 className="card-title">Bull vs Bear Debate</h2>
      <div className="debate-columns">
        <div className="debate-side debate-bull">
          <div className="debate-side-header">
            <span className="debate-side-icon debate-bull-icon">{'\u2191'}</span>
            <span className="debate-side-label">Bull Case</span>
          </div>
          <div className="debate-side-text">
            {expanded ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {debate?.full_bull_history || bullOpening}
              </ReactMarkdown>
            ) : (
              <p>{firstSentences(bullOpening, 2) || bullOpening}</p>
            )}
          </div>
        </div>
        <div className="debate-divider" />
        <div className="debate-side debate-bear">
          <div className="debate-side-header">
            <span className="debate-side-icon debate-bear-icon">{'\u2193'}</span>
            <span className="debate-side-label">Bear Case</span>
          </div>
          <div className="debate-side-text">
            {expanded ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {debate?.full_bear_history || bearOpening}
              </ReactMarkdown>
            ) : (
              <p>{firstSentences(bearOpening, 2) || bearOpening}</p>
            )}
          </div>
        </div>
      </div>
      {(debate?.full_bull_history || debate?.full_bear_history) && (
        <button
          className="debate-expand-btn"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show Summary' : 'Show Full Debate'}
        </button>
      )}
    </div>
  );
}

interface AnalystCardProps {
  name: string;
  reportMarkdown?: string;
}

function AnalystCard({ name, reportMarkdown }: AnalystCardProps) {
  const [expanded, setExpanded] = useState(false);

  const summary = firstSentences(reportMarkdown, 1) || 'No report available.';

  return (
    <div className={`analyst-card ${expanded ? 'analyst-card-expanded' : ''}`}>
      <div className="analyst-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="analyst-card-left">
          <div className="analyst-card-name">{name}</div>
          {!expanded && <div className="analyst-card-summary">{summary}</div>}
        </div>
        <button className="analyst-toggle-btn" aria-label="Toggle report">
          {expanded ? 'Hide Report' : 'Show Full Report'}
        </button>
      </div>
      {expanded && (
        <div className="analyst-card-body">
          <div className="analyst-report-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {reportMarkdown || 'No report available.'}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

interface AnalystReportsSectionProps {
  analysts?: Analysts;
}

function AnalystReportsSection({ analysts }: AnalystReportsSectionProps) {
  const sections: Array<{ key: keyof Analysts; label: string }> = [
    { key: 'market', label: 'Market Analyst' },
    { key: 'sentiment', label: 'Sentiment Analyst' },
    { key: 'news', label: 'News Analyst' },
    { key: 'fundamentals', label: 'Fundamentals Analyst' },
  ];

  return (
    <div className="card dashboard-grid-full">
      <h2 className="card-title">Analyst Reports</h2>
      <div className="analyst-list">
        {sections.map(({ key, label }) => {
          const report = analysts?.[key]?.report_markdown;
          return <AnalystCard key={key} name={label} reportMarkdown={report} />;
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/*  Main Dashboard component                               */
/* ────────────────────────────────────────────────────── */

interface DashboardProps {
  data: StructuredOutput;
}

export default function Dashboard({ data }: DashboardProps) {
  if (!data) {
    return (
      <div className="dashboard dashboard-empty">
        <p className="dashboard-empty-text">No data available.</p>
      </div>
    );
  }

  const { metadata, research_manager, trader, analysts, debate } = data;

  return (
    <div className="dashboard">
      <HeroHeader metadata={metadata} />

      <ExecutiveSummaryCard verdictMarkdown={research_manager?.verdict_markdown} />

      <PipelineVisualization />

      <TrendVisualization data={data} />

      <div className="dashboard-grid">
        <PriceTargetsCard researchManager={research_manager} trader={trader} />
        <ScenarioProbabilitiesCard researchManager={research_manager} trader={trader} />
        <RiskCard researchManager={research_manager} trader={trader} />
        <DebateCard debate={debate} />
        <AnalystReportsSection analysts={analysts} />
      </div>
    </div>
  );
}
