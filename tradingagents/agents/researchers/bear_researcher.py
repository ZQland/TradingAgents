from langchain_core.messages import AIMessage
from tradingagents.agents.utils.agent_utils import ensure_str
import time
import json


def create_bear_researcher(llm, memory):
    def bear_node(state) -> dict:
        investment_debate_state = state["investment_debate_state"]
        history = investment_debate_state.get("history", "")
        bear_history = investment_debate_state.get("bear_history", "")

        current_response = investment_debate_state.get("current_response", "")
        market_research_report = state["market_report"]
        sentiment_report = state["sentiment_report"]
        news_report = state["news_report"]
        fundamentals_report = state["fundamentals_report"]
        analyst_summary = state.get("analyst_summary", "")

        past_memories = memory.get_memories(analyst_summary, n_matches=2)

        past_memory_str = ""
        for i, rec in enumerate(past_memories, 1):
            past_memory_str += rec["recommendation"] + "\n\n"

        prompt = f"""You are a Bear Analyst. Your task is to make a compelling, data-driven case for why this stock will be LOWER 30-60 days from now. Ground every argument in specific upcoming risks, deteriorating trends, or overvaluation setups — not just a description of current conditions.

Key points to focus on:
- Price Trajectory: Where specifically will this stock be in 30-60 days and why? Name a downside target and the path to get there.
- Upcoming Risk Events: Identify specific upcoming events (earnings miss risk, macro deterioration, technical breakdowns, regulatory threats) that will pressure the price lower. Be specific about timing.
- Trend Deterioration or Breakdown Setup: If technically bearish, project where the selling leads. If overextended, explain the mean-reversion downside thesis with specific levels.
- Bull Counterpoints: Address the bull's catalysts directly — explain why those anticipated events are already priced in, likely to disappoint, or won't materialize in the 30-60 day window.
- Engagement: Present your argument conversationally, debating forward-looking scenarios rather than just describing what has already happened.

Resources available:
Market research report: {market_research_report}
Social media sentiment report: {sentiment_report}
Latest world affairs news: {news_report}
Company fundamentals report: {fundamentals_report}
Conversation history of the debate: {history}
Last bull argument: {current_response}
Reflections from similar situations and lessons learned: {past_memory_str}
Use this information to deliver a compelling bear argument, refute the bull's claims, and engage in a dynamic debate that demonstrates the risks and weaknesses of investing in the stock. You must also address reflections and learn from lessons and mistakes you made in the past.
"""

        response = llm.invoke(prompt)

        argument = f"Bear Analyst: {ensure_str(response.content)}"

        new_investment_debate_state = {
            "history": history + "\n" + argument,
            "bear_history": bear_history + "\n" + argument,
            "bull_history": investment_debate_state.get("bull_history", ""),
            "current_response": argument,
            "count": investment_debate_state["count"] + 1,
        }

        return {"investment_debate_state": new_investment_debate_state}

    return bear_node
