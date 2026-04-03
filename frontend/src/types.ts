export interface PriceTargets {
  day_30: number | null;
  day_60: number | null;
  day_90: number | null;
}

export interface Probabilities {
  bull: number | null;
  base: number | null;
  bear: number | null;
}

export interface Metadata {
  ticker: string;
  trade_date: string;
  decision: string;
  confidence: number | null;
}

export interface AnalystReport {
  report_markdown: string;
}

export interface Analysts {
  market: AnalystReport;
  sentiment: AnalystReport;
  news: AnalystReport;
  fundamentals: AnalystReport;
}

export interface DebateData {
  bull_opening: string;
  bear_opening: string;
  full_bull_history: string;
  full_bear_history: string;
  full_history: string;
}

export interface ResearchManager {
  verdict_markdown: string;
  recommendation: string;
  price_targets: PriceTargets | null;
  probabilities: Probabilities | null;
  stop_loss: number | null;
  thesis_invalidation: string | null;
}

export interface Trader {
  plan_markdown: string;
  decision: string;
  price_targets: PriceTargets | null;
  probabilities: Probabilities | null;
  stop_loss: number | null;
  position_sizing: string | null;
  reversal_conditions: string | null;
}

export interface RiskAssessment {
  final_decision_markdown: string;
  recommendation: string;
  confidence: number | null;
}

export interface Newsletters {
  free_markdown: string;
  premium_markdown: string;
}

export interface StructuredOutput {
  version: string;
  generated_at: string;
  metadata: Metadata;
  analysts: Analysts;
  analyst_summary: string;
  debate: DebateData;
  research_manager: ResearchManager;
  trader: Trader;
  risk_assessment: RiskAssessment;
  newsletters: Newsletters;
}
