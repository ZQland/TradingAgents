from langchain_core.messages import AIMessage
from tradingagents.agents.utils.agent_utils import ensure_str
import time
import json


def create_bull_researcher(llm, memory):
    def bull_node(state) -> dict:
        investment_debate_state = state["investment_debate_state"]
        history = investment_debate_state.get("history", "")
        bull_history = investment_debate_state.get("bull_history", "")

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

        prompt = f"""You are a Bull Analyst. Your task is to make a compelling, data-driven case for why this stock will be HIGHER 30-60 days from now. Ground every argument in specific future catalysts, trend continuations, or mean-reversion setups — not just a description of current conditions.

Key points to focus on:
- Price Trajectory: Where specifically will this stock be in 30-60 days and why? Name a price target and the path to get there.
- Upcoming Catalysts: Identify specific upcoming events (earnings, product launches, macro tailwinds, technical breakouts) that will drive the price higher. Be specific about timing.
- Trend Continuation or Reversal Setup: If technically bullish, project where momentum leads. If oversold, explain the mean-reversion thesis with specific levels.
- Bear Counterpoints: Address the bear's concerns directly — explain why those risks are already priced in or why they won't materialize in the 30-60 day window.
- Engagement: Present your argument conversationally, debating forward-looking scenarios rather than just describing what has already happened.

Resources available:
Market research report: {market_research_report}
Social media sentiment report: {sentiment_report}
Latest world affairs news: {news_report}
Company fundamentals report: {fundamentals_report}
Conversation history of the debate: {history}
Last bear argument: {current_response}
Reflections from similar situations and lessons learned: {past_memory_str}
Use this information to deliver a compelling bull argument, refute the bear's concerns, and engage in a dynamic debate that demonstrates the strengths of the bull position. You must also address reflections and learn from lessons and mistakes you made in the past.
"""

        response = llm.invoke(prompt)

        argument = f"Bull Analyst: {ensure_str(response.content)}"

        new_investment_debate_state = {
            "history": history + "\n" + argument,
            "bull_history": bull_history + "\n" + argument,
            "bear_history": investment_debate_state.get("bear_history", ""),
            "current_response": argument,
            "count": investment_debate_state["count"] + 1,
        }

        return {"investment_debate_state": new_investment_debate_state}

    return bull_node
