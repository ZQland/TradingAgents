# TradingAgents/graph/newsletter.py

from pathlib import Path


NEWSLETTER_PROMPT = """\
You are a financial newsletter writer. Given the outputs from a multi-agent trading analysis system, produce a concise, newsletter-ready summary that a human can read in under 2 minutes.

STRICT RULES:
- Total output must be under 600 words
- Use plain markdown (headers, bullets, bold key terms)
- Be specific: include actual numbers, percentages, price levels mentioned in the reports
- No filler phrases like "it's important to note" or "in conclusion"
- The DECISION line must be exactly one of: BUY, SELL, or HOLD

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

FUNDAMENTALS REPORT:
{fundamentals_report}

RESEARCH DEBATE SUMMARY (Bull vs Bear):
{investment_debate}

FINAL RISK MANAGER DECISION:
{final_trade_decision}

---

Output this exact structure (fill in each section — do not leave any section empty):

# {ticker} — {trade_date}

## Decision: {decision}

## Executive Summary
[2-3 sentences. What is the overall situation and why did the system arrive at this decision?]

## Key Signals

**Technical:** [2-3 bullets with actual indicator values e.g. RSI, MACD, SMA levels]

**Sentiment & News:** [2-3 bullets on social/news themes]

**Fundamentals:** [2-3 bullets on financial health, insider activity, valuation]

## Bull Case
[3 strongest arguments for buying/holding, with supporting data points]

## Bear Case
[3 strongest arguments for selling/caution, with supporting data points]

## Risk & Trade Parameters
[Key risk factors. If entry price, stop-loss, or price targets were mentioned in the final decision, include them here.]

## Confidence Level
[High / Medium / Low — one sentence justifying the level based on consensus or disagreement between analysts]

---
*TradingAgents Analysis | {trade_date}*
"""


class NewsletterGenerator:
    """Generates a concise, newsletter-ready summary from full agent outputs."""

    def __init__(self, llm):
        self.llm = llm

    def generate(self, ticker: str, trade_date: str, decision: str, final_state: dict) -> str:
        """
        Generate a newsletter summary from the final agent state.

        Args:
            ticker: Stock ticker symbol
            trade_date: Analysis date string
            decision: Extracted decision (BUY/SELL/HOLD)
            final_state: Complete final state dict from the graph run

        Returns:
            Markdown string of the newsletter summary
        """
        debate_state = final_state.get("investment_debate_state", {})
        debate_summary = debate_state.get("history", "") or debate_state.get("judge_decision", "")

        prompt = NEWSLETTER_PROMPT.format(
            ticker=ticker,
            trade_date=trade_date,
            decision=decision,
            market_report=final_state.get("market_report", "Not available"),
            sentiment_report=final_state.get("sentiment_report", "Not available"),
            news_report=final_state.get("news_report", "Not available"),
            fundamentals_report=final_state.get("fundamentals_report", "Not available"),
            investment_debate=debate_summary or "Not available",
            final_trade_decision=final_state.get("final_trade_decision", "Not available"),
        )

        response = self.llm.invoke(prompt)
        return response.content

    def save(self, newsletter: str, results_dir: str, ticker: str, trade_date: str) -> Path:
        """
        Save the newsletter to disk alongside the raw reports.

        Saves to: {results_dir}/{ticker}/{trade_date}/newsletter_{ticker}_{trade_date}.md

        Args:
            newsletter: Markdown content to save
            results_dir: Base results directory from config
            ticker: Stock ticker symbol
            trade_date: Analysis date string

        Returns:
            Path to the saved file
        """
        output_dir = Path(results_dir) / ticker / str(trade_date)
        output_dir.mkdir(parents=True, exist_ok=True)

        path = output_dir / f"newsletter_{ticker}_{trade_date}.md"
        with open(path, "w") as f:
            f.write(newsletter)

        return path
