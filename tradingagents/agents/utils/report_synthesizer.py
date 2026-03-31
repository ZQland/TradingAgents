# TradingAgents/agents/utils/report_synthesizer.py

SYNTHESIS_PROMPT = """\
You are a financial analyst distilling four detailed reports into a compact briefing \
for a debate team. Extract only the most decision-relevant facts. Be specific — \
include actual numbers, price levels, and percentages. Do not editorialize.

MARKET & TECHNICAL REPORT:
{market_report}

SENTIMENT REPORT:
{sentiment_report}

NEWS REPORT:
{news_report}

FUNDAMENTALS REPORT:
{fundamentals_report}

---

Output EXACTLY this structure (4 sections, bullets only, no prose paragraphs):

## Technical Signals
[4-5 bullets: price vs key moving averages with levels, RSI value, MACD status, \
Bollinger position, volume trend]

## Sentiment & News
[3-4 bullets: social sentiment tone, key news events with direct market impact, \
macro backdrop, any catalysts]

## Fundamentals
[3-4 bullets: revenue/earnings picture with figures, valuation metric(s), \
balance sheet health, insider activity if available]

## Key Tensions
[2-3 bullets: the most important conflicts across the four reports that the \
debate must resolve — e.g. strong fundamentals vs. bearish technicals]
"""


def create_report_synthesizer(llm):
    """
    Returns a LangGraph node function that compresses the four analyst reports
    into a single ~300-token `analyst_summary` field in AgentState.

    This node sits between the analyst fan-in and the Bull Researcher.
    All downstream debate/decision agents read analyst_summary instead of
    the four raw reports, reducing context size by ~70% for those agents.
    The raw reports remain in state unchanged for the newsletter and saved files.
    """

    def synthesizer_node(state) -> dict:
        market_report = state.get("market_report", "Not available")
        sentiment_report = state.get("sentiment_report", "Not available")
        news_report = state.get("news_report", "Not available")
        fundamentals_report = state.get("fundamentals_report", "Not available")

        prompt = SYNTHESIS_PROMPT.format(
            market_report=market_report,
            sentiment_report=sentiment_report,
            news_report=news_report,
            fundamentals_report=fundamentals_report,
        )

        response = llm.invoke(prompt)
        return {"analyst_summary": response.content}

    return synthesizer_node
