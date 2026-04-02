from tradingagents.agents.utils.agent_utils import ensure_str
import functools
import time
import json


def create_trader(llm, memory):
    def trader_node(state, name):
        company_name = state["company_of_interest"]
        investment_plan = state["investment_plan"]
        analyst_summary = state.get("analyst_summary", "")

        past_memories = memory.get_memories(analyst_summary, n_matches=2)

        past_memory_str = ""
        for i, rec in enumerate(past_memories, 1):
            past_memory_str += rec["recommendation"] + "\n\n"

        context = {
            "role": "user",
            "content": f"Based on a comprehensive analysis by a team of analysts, here is an investment plan tailored for {company_name}. This plan incorporates insights from current technical market trends, macroeconomic indicators, and social media sentiment. Use this plan as a foundation for evaluating your next trading decision.\n\nAnalyst Briefing:\n{analyst_summary}\n\nProposed Investment Plan: {investment_plan}\n\nLeverage these insights to make an informed and strategic decision.",
        }

        messages = [
            {
                "role": "system",
                "content": f"""You are a trading agent analyzing market data to make investment decisions. Based on your analysis, provide a specific recommendation to buy, sell, or hold.

Your response MUST include ALL of the following structured sections:

1. **Decision**: BUY / SELL / HOLD with one-sentence rationale
2. **Position Sizing & Entry Strategy**: How to enter (all-at-once, scaled, etc.), position size relative to portfolio
3. **Price Targets**:
   - 30-Day Target: specific price with key driver
   - 60-Day Target: specific price with key driver
   - 90-Day Target: specific price with key driver
4. **Scenario Probabilities** (MUST sum to exactly 100%):
   - Bull Case (15%+ upside): probability and price target
   - Base Case: probability and expected price range
   - Bear Case (15%+ downside): probability and price target
5. **Stop-Loss Level**: specific price where thesis breaks down
6. **Risk Management**: how to manage the position if it moves against you
7. **Reversal Plan**: under what conditions you would reverse the position entirely

End with: FINAL TRANSACTION PROPOSAL: **BUY/HOLD/SELL**

Do not forget to utilize lessons from past decisions to learn from your mistakes. Here are reflections from similar situations you traded in and the lessons learned: {past_memory_str}""",
            },
            context,
        ]

        result = llm.invoke(messages)

        return {
            "messages": [result],
            "trader_investment_plan": ensure_str(result.content),
            "sender": name,
        }

    return functools.partial(trader_node, name="Trader")
