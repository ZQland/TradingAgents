# TradingAgents/graph/newsletter.py

from pathlib import Path


# ---------------------------------------------------------------------------
# FREE TIER — ~300-600 words
# Surface-level signals: market, sentiment, news, and the opening salvo from
# each researcher. Good for a quick read or a public-facing newsletter.
# ---------------------------------------------------------------------------

FREE_TIER_PROMPT = """\
You are a financial newsletter writer producing the FREE edition of a trading signal digest.

STRICT RULES:
- Total output: 300–600 words (hard limit — do not exceed)
- Plain markdown only (headers, bullets, bold key terms)
- Include actual numbers and percentages from the reports where available
- No filler phrases ("it is worth noting", "in conclusion", "it's important to")
- The Decision line must be exactly one of: BUY, SELL, or HOLD

---

TICKER: {ticker}
DATE: {trade_date}
DECISION: {decision}

MARKET & TECHNICAL REPORT:
{market_report}

SENTIMENT REPORT:
{sentiment_report}

NEWS REPORT:
{news_report}

BULL RESEARCHER — OPENING STATEMENT:
{bull_opening}

BEAR RESEARCHER — OPENING STATEMENT:
{bear_opening}

---

Output this exact structure:

# {ticker} — {trade_date} | FREE EDITION

## Decision: {decision}

## What's Happening
[2 sentences: the core situation and what's driving the signal]

## Market Snapshot
[3 bullets with actual indicator values — RSI, trend direction, key moving averages, volume signal, etc.]

## Sentiment & News
[3 bullets: social sentiment tone, key news themes, macro backdrop]

## The Debate
**Bull case:** [2-3 sentences summarising the opening bull argument — cite specific data points]

**Bear case:** [2-3 sentences summarising the opening bear argument — cite specific data points]

## Bottom Line
[1-2 sentences: why the system landed on {decision}]

---
*TradingAgents Free Edition | {trade_date} — [Upgrade to Premium for full fundamentals, research manager rationale, and trader action plan]*
"""


# ---------------------------------------------------------------------------
# PREMIUM TIER — ~1200-1800 words
# Full depth: everything in free tier plus complete fundamentals, the research
# manager's full rationale (including lessons from past mistakes), and the
# trader's concrete action plan.
# ---------------------------------------------------------------------------

PREMIUM_TIER_PROMPT = """\
You are a financial newsletter writer producing the PREMIUM edition of a trading signal digest.

STRICT RULES:
- Total output: 1200–1800 words (hard limit — stay within range)
- Plain markdown only (headers, sub-headers, bullets, bold key terms)
- Include actual numbers, percentages, and price levels from the reports
- No filler phrases ("it is worth noting", "in conclusion", "it's important to")
- The Decision line must be exactly one of: BUY, SELL, or HOLD

---

TICKER: {ticker}
DATE: {trade_date}
DECISION: {decision}

MARKET & TECHNICAL REPORT:
{market_report}

SENTIMENT REPORT:
{sentiment_report}

NEWS REPORT:
{news_report}

FUNDAMENTALS REPORT (FULL):
{fundamentals_report}

BULL RESEARCHER — OPENING STATEMENT:
{bull_opening}

BEAR RESEARCHER — OPENING STATEMENT:
{bear_opening}

RESEARCH MANAGER — FULL VERDICT (including rationale and past-mistake reflections):
{investment_plan}

TRADER — ACTION PLAN:
{trader_investment_plan}

FINAL RISK MANAGER DECISION:
{final_trade_decision}

---

Output this exact structure:

# {ticker} — {trade_date} | PREMIUM EDITION

## Decision: {decision}

## Executive Summary
[3-4 sentences: full situation, key drivers, and confidence level]

## Market & Technical Analysis
[4-5 bullets with specific indicator values, trend context, volume, and what they imply]

## Sentiment & News Environment
[3-4 bullets: social sentiment tone, specific news events, macro backdrop and its relevance]

## Deep Fundamentals
[5-6 bullets covering: revenue/earnings picture, balance sheet strength, insider activity, valuation metrics, competitive positioning — use actual figures]

## The Research Debate

**Bull Opening:**
[3-4 sentences capturing the strongest bull arguments with supporting data]

**Bear Opening:**
[3-4 sentences capturing the strongest bear arguments with supporting data]

**Net Assessment:**
[2-3 sentences on which side made the more compelling case and why]

## Research Manager's Verdict
[Full rationale for the investment recommendation — include any lessons from past mistakes the manager explicitly noted, and how those influenced this decision]

## Trader's Action Plan
[Concrete steps from the trader: entry approach, position sizing logic, stop-loss level, price targets, time horizon — quote specific levels if mentioned]

## Risk Factors
[3 bullets: the most important risks that could invalidate this trade]

## Confidence Assessment
**Level:** [High / Medium / Low]
[2 sentences justifying the level based on analyst consensus vs. disagreement]

---
*TradingAgents Premium Edition | {trade_date}*
"""


def _extract_opening_statement(history: str, analyst_label: str) -> str:
    """
    Extract just the first argument from a researcher's debate history.

    History is accumulated as:
      "\\nBull Analyst: [first argument]\\nBull Analyst: [second argument]..."

    Args:
        history: Full debate history string (bull_history or bear_history)
        analyst_label: Prefix used in the history e.g. "Bull Analyst"

    Returns:
        The text of the first argument, stripped of the analyst label prefix.
    """
    stripped = history.strip()
    if not stripped:
        return "Not available"

    prefix = f"{analyst_label}:"
    if stripped.startswith(prefix):
        stripped = stripped[len(prefix):].strip()

    # Everything before the next occurrence of the label (second round)
    next_idx = stripped.find(f"\n{analyst_label}:")
    if next_idx != -1:
        stripped = stripped[:next_idx].strip()

    return stripped or "Not available"


class NewsletterGenerator:
    """Generates free-tier and premium-tier newsletter summaries from agent outputs."""

    def __init__(self, llm):
        self.llm = llm

    def _build_context(self, ticker: str, trade_date: str, decision: str, final_state: dict) -> dict:
        """Extract and prepare all fields needed by both tier prompts."""
        debate_state = final_state.get("investment_debate_state", {})

        bull_opening = _extract_opening_statement(
            debate_state.get("bull_history", ""), "Bull Analyst"
        )
        bear_opening = _extract_opening_statement(
            debate_state.get("bear_history", ""), "Bear Analyst"
        )

        return dict(
            ticker=ticker,
            trade_date=str(trade_date),
            decision=decision,
            market_report=final_state.get("market_report", "Not available"),
            sentiment_report=final_state.get("sentiment_report", "Not available"),
            news_report=final_state.get("news_report", "Not available"),
            fundamentals_report=final_state.get("fundamentals_report", "Not available"),
            bull_opening=bull_opening,
            bear_opening=bear_opening,
            investment_plan=final_state.get("investment_plan", "Not available"),
            trader_investment_plan=final_state.get("trader_investment_plan", "Not available"),
            final_trade_decision=final_state.get("final_trade_decision", "Not available"),
        )

    def generate_free(self, ticker: str, trade_date: str, decision: str, final_state: dict) -> str:
        """Generate the free-tier newsletter (300-600 words)."""
        ctx = self._build_context(ticker, trade_date, decision, final_state)
        prompt = FREE_TIER_PROMPT.format(**ctx)
        return self.llm.invoke(prompt).content

    def generate_premium(self, ticker: str, trade_date: str, decision: str, final_state: dict) -> str:
        """Generate the premium-tier newsletter (1200-1800 words)."""
        ctx = self._build_context(ticker, trade_date, decision, final_state)
        prompt = PREMIUM_TIER_PROMPT.format(**ctx)
        return self.llm.invoke(prompt).content

    def save(
        self,
        free_newsletter: str,
        premium_newsletter: str,
        results_dir: str,
        ticker: str,
        trade_date: str,
    ) -> tuple:
        """
        Save both newsletter tiers into the reports/ subfolder alongside
        all other raw report files.

        Output paths:
          {results_dir}/{ticker}/{trade_date}/reports/newsletter_free_{ticker}_{trade_date}.md
          {results_dir}/{ticker}/{trade_date}/reports/newsletter_premium_{ticker}_{trade_date}.md

        Returns:
            Tuple of (free_path, premium_path)
        """
        output_dir = Path(results_dir) / ticker / str(trade_date) / "reports"
        output_dir.mkdir(parents=True, exist_ok=True)

        free_path = output_dir / f"newsletter_free_{ticker}_{trade_date}.md"
        premium_path = output_dir / f"newsletter_premium_{ticker}_{trade_date}.md"

        with open(free_path, "w") as f:
            f.write(free_newsletter)
        with open(premium_path, "w") as f:
            f.write(premium_newsletter)

        return free_path, premium_path
