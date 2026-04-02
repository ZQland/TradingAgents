# TradingAgents/graph/structured_output.py

import json
from datetime import datetime, timezone
from pathlib import Path

from .newsletter import _extract_opening_statement


# ---------------------------------------------------------------------------
# Default structure returned when extraction fails
# ---------------------------------------------------------------------------

_NULL_EXTRACTED = {
    "research_manager": {
        "recommendation": None,
        "price_targets": {"day_30": None, "day_60": None, "day_90": None},
        "probabilities": {"bull": None, "base": None, "bear": None},
        "stop_loss": None,
        "thesis_invalidation": None,
    },
    "trader": {
        "decision": None,
        "price_targets": {"day_30": None, "day_60": None, "day_90": None},
        "probabilities": {"bull": None, "base": None, "bear": None},
        "stop_loss": None,
        "position_sizing": None,
        "reversal_conditions": None,
    },
}

_EXTRACTION_PROMPT = """\
You are a data extraction assistant. Extract structured financial data from \
the two text sections below. Return ONLY valid JSON — no commentary, no markdown fences.

If a value cannot be found, use null. All prices must be plain numbers (no $ signs). \
All probabilities must be integers 0-100 (no % signs). Strings should be short (one sentence max).

RESEARCH MANAGER VERDICT:
{investment_plan}

TRADER ACTION PLAN:
{trader_investment_plan}

Return JSON in this exact shape:
{{
  "research_manager": {{
    "recommendation": "BUY" or "SELL" or "HOLD" or null,
    "price_targets": {{
      "day_30": <number or null>,
      "day_60": <number or null>,
      "day_90": <number or null>
    }},
    "probabilities": {{
      "bull": <integer 0-100 or null>,
      "base": <integer 0-100 or null>,
      "bear": <integer 0-100 or null>
    }},
    "stop_loss": <number or null>,
    "thesis_invalidation": <short string or null>
  }},
  "trader": {{
    "decision": "BUY" or "SELL" or "HOLD" or null,
    "price_targets": {{
      "day_30": <number or null>,
      "day_60": <number or null>,
      "day_90": <number or null>
    }},
    "probabilities": {{
      "bull": <integer 0-100 or null>,
      "base": <integer 0-100 or null>,
      "bear": <integer 0-100 or null>
    }},
    "stop_loss": <number or null>,
    "position_sizing": <short string or null>,
    "reversal_conditions": <short string or null>
  }}
}}"""


class StructuredDataExtractor:
    """Extracts numeric/structured fields from freeform agent text via a single LLM call."""

    def __init__(self, llm):
        self.llm = llm

    def extract(self, investment_plan: str, trader_investment_plan: str) -> dict:
        """Extract structured fields from research manager and trader text.

        Returns a dict matching ``_NULL_EXTRACTED`` shape.  On any failure
        (malformed JSON, LLM error, etc.) returns the all-null default.
        """
        try:
            prompt = _EXTRACTION_PROMPT.format(
                investment_plan=investment_plan or "Not available",
                trader_investment_plan=trader_investment_plan or "Not available",
            )
            result = self.llm.invoke(prompt)
            content = result.content if hasattr(result, "content") else str(result)
            # Strip markdown fences if the LLM wraps them
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1] if "\n" in content else content
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()
            parsed = json.loads(content)
            # Validate top-level keys exist
            if "research_manager" not in parsed or "trader" not in parsed:
                return _NULL_EXTRACTED
            return parsed
        except Exception:
            return _NULL_EXTRACTED


def build_structured_json(
    ticker: str,
    trade_date: str,
    decision: str,
    confidence: int,
    final_state: dict,
    extracted_fields: dict,
    free_newsletter: str = None,
    premium_newsletter: str = None,
) -> dict:
    """Assemble the complete structured JSON from state + extracted fields.

    This is a pure function — no LLM calls.
    """
    debate_state = final_state.get("investment_debate_state", {})
    risk_state = final_state.get("risk_debate_state", {})

    bull_opening = _extract_opening_statement(
        debate_state.get("bull_history", ""), "Bull Analyst"
    )
    bear_opening = _extract_opening_statement(
        debate_state.get("bear_history", ""), "Bear Analyst"
    )

    rm = extracted_fields.get("research_manager", _NULL_EXTRACTED["research_manager"])
    tr = extracted_fields.get("trader", _NULL_EXTRACTED["trader"])

    return {
        "version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "metadata": {
            "ticker": ticker,
            "trade_date": str(trade_date),
            "decision": decision,
            "confidence": confidence,
        },
        "analysts": {
            "market": {
                "report_markdown": final_state.get("market_report", ""),
            },
            "sentiment": {
                "report_markdown": final_state.get("sentiment_report", ""),
            },
            "news": {
                "report_markdown": final_state.get("news_report", ""),
            },
            "fundamentals": {
                "report_markdown": final_state.get("fundamentals_report", ""),
            },
        },
        "analyst_summary": final_state.get("analyst_summary", ""),
        "debate": {
            "bull_opening": bull_opening,
            "bear_opening": bear_opening,
            "full_bull_history": debate_state.get("bull_history", ""),
            "full_bear_history": debate_state.get("bear_history", ""),
            "full_history": debate_state.get("history", ""),
        },
        "research_manager": {
            "verdict_markdown": final_state.get("investment_plan", ""),
            "recommendation": rm.get("recommendation"),
            "price_targets": rm.get("price_targets", {"day_30": None, "day_60": None, "day_90": None}),
            "probabilities": rm.get("probabilities", {"bull": None, "base": None, "bear": None}),
            "stop_loss": rm.get("stop_loss"),
            "thesis_invalidation": rm.get("thesis_invalidation"),
        },
        "trader": {
            "plan_markdown": final_state.get("trader_investment_plan", ""),
            "decision": tr.get("decision"),
            "price_targets": tr.get("price_targets", {"day_30": None, "day_60": None, "day_90": None}),
            "probabilities": tr.get("probabilities", {"bull": None, "base": None, "bear": None}),
            "stop_loss": tr.get("stop_loss"),
            "position_sizing": tr.get("position_sizing"),
            "reversal_conditions": tr.get("reversal_conditions"),
        },
        "risk_assessment": {
            "final_decision_markdown": final_state.get("final_trade_decision", ""),
            "recommendation": decision,
            "confidence": confidence,
        },
        "newsletters": {
            "free_markdown": free_newsletter,
            "premium_markdown": premium_newsletter,
        },
    }


def save_structured_json(
    json_data: dict,
    results_dir: str,
    ticker: str,
    trade_date: str,
) -> Path:
    """Save structured JSON to the reports directory.

    Output path:
        {results_dir}/{ticker}/{trade_date}/reports/structured_output.json

    Returns the Path to the saved file.
    """
    output_dir = Path(results_dir) / ticker / str(trade_date) / "reports"
    output_dir.mkdir(parents=True, exist_ok=True)

    output_path = output_dir / "structured_output.json"
    with open(output_path, "w") as f:
        json.dump(json_data, f, indent=2, ensure_ascii=False)

    return output_path
