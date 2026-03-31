from tradingagents.agents.utils.agent_utils import ensure_str
import time
import json


def create_research_manager(llm, memory):
    def research_manager_node(state) -> dict:
        history = state["investment_debate_state"].get("history", "")
        analyst_summary = state.get("analyst_summary", "")
        investment_debate_state = state["investment_debate_state"]

        past_memories = memory.get_memories(analyst_summary, n_matches=2)

        past_memory_str = ""
        for i, rec in enumerate(past_memories, 1):
            past_memory_str += rec["recommendation"] + "\n\n"

        prompt = f"""As the portfolio manager and debate facilitator, your role is to critically evaluate this round of debate and make a definitive, forward-looking decision: align with the bear analyst, the bull analyst, or choose Hold only if strongly justified.

Summarize the key points from both sides concisely, focusing on the most compelling forward-looking evidence. Your recommendation—Buy, Sell, or Hold—must be clear, actionable, and anchored in where the stock is likely to be 30-90 days from now, not just where it is today.

Develop a detailed investment plan for the trader that MUST include all of the following:

1. Recommendation: Buy / Sell / Hold with a one-sentence summary of the core thesis.
2. Rationale: Why the winning side's forward-looking arguments are more convincing. What specific catalyst or trend drives the 30-60 day outcome?
3. 30-Day Price Target: A specific price level the stock is likely to reach in 30 days, with the key driver.
4. 90-Day Price Target: A specific price level for the 90-day horizon, acknowledging greater uncertainty.
5. Probability Assessment: Assign a percentage probability to the base case scenario. Then state the Bull Scenario probability (15%+ upside in 60 days), Bear Scenario probability (15%+ downside in 60 days), and Base Case probability. These three must sum to 100%.
6. Thesis Invalidation: The single most important event or data point that would prove this thesis wrong. If this happens, the position should be reversed.
7. Stop-Loss Level: A specific price level at which the technical or fundamental thesis breaks down and the position must be exited.
8. Strategic Actions: Concrete entry/sizing steps for implementing the recommendation.
9. Scenario Analysis (MANDATORY):
   - Bull Scenario (15%+ upside within 60 days): Name the specific combination of events — macro catalyst, earnings beat, technical breakout, sentiment shift — that would need to occur. Assign a probability.
   - Bear Scenario (15%+ downside within 60 days): Name the specific combination of events that would drive this move lower. Assign a probability.
   - Base Case: The most likely path. What is the expected price range at 30 and 60 days if neither extreme scenario plays out?

Take into account your past mistakes on similar situations and explicitly note if any past error pattern is relevant here.
Present your analysis conversationally, as if speaking naturally, without special formatting.

Here is the analyst briefing (market, sentiment, news, fundamentals summary):
{analyst_summary}

Here are your past reflections on mistakes:
\"{past_memory_str}\"

Here is the debate:
Debate History:
{history}"""
        response = llm.invoke(prompt)
        content = ensure_str(response.content)

        new_investment_debate_state = {
            "judge_decision": content,
            "history": investment_debate_state.get("history", ""),
            "bear_history": investment_debate_state.get("bear_history", ""),
            "bull_history": investment_debate_state.get("bull_history", ""),
            "current_response": content,
            "count": investment_debate_state["count"],
        }

        return {
            "investment_debate_state": new_investment_debate_state,
            "investment_plan": content,
        }

    return research_manager_node
