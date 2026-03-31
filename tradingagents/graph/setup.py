# TradingAgents/graph/setup.py

from typing import Dict, Any
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph, START
from langgraph.prebuilt import ToolNode

from tradingagents.agents import *
from tradingagents.agents.utils.agent_states import AgentState, AnalystState
from tradingagents.agents.utils.agent_utils import Toolkit

from .conditional_logic import ConditionalLogic

# Maps analyst type to the report key it writes in the parent AgentState
REPORT_KEY_MAP = {
    "market": "market_report",
    "social": "sentiment_report",
    "news": "news_report",
    "fundamentals": "fundamentals_report",
}


class GraphSetup:
    """Handles the setup and configuration of the agent graph."""

    def __init__(
        self,
        quick_thinking_llm: ChatOpenAI,
        deep_thinking_llm: ChatOpenAI,
        toolkit: Toolkit,
        tool_nodes: Dict[str, ToolNode],
        bull_memory,
        bear_memory,
        trader_memory,
        invest_judge_memory,
        risk_manager_memory,
        conditional_logic: ConditionalLogic,
    ):
        """Initialize with required components."""
        self.quick_thinking_llm = quick_thinking_llm
        self.deep_thinking_llm = deep_thinking_llm
        self.toolkit = toolkit
        self.tool_nodes = tool_nodes
        self.bull_memory = bull_memory
        self.bear_memory = bear_memory
        self.trader_memory = trader_memory
        self.invest_judge_memory = invest_judge_memory
        self.risk_manager_memory = risk_manager_memory
        self.conditional_logic = conditional_logic

    def _build_analyst_subgraph(self, analyst_type, analyst_node, tool_node):
        """Build a subgraph for a single analyst with isolated messages."""
        report_key = REPORT_KEY_MAP[analyst_type]

        def adapted_analyst(state):
            result = analyst_node(state)
            adapted = {"messages": result["messages"]}
            if result.get(report_key):
                adapted["report"] = result[report_key]
            return adapted

        def should_continue(state):
            last_message = state["messages"][-1]
            if last_message.tool_calls:
                return "tools"
            return "clear"

        def clear_messages(state):
            return create_msg_delete()(state)

        sg = StateGraph(AnalystState)
        sg.add_node("analyst", adapted_analyst)
        sg.add_node("tools", tool_node)
        sg.add_node("clear", clear_messages)

        sg.add_edge(START, "analyst")
        sg.add_conditional_edges("analyst", should_continue, ["tools", "clear"])
        sg.add_edge("tools", "analyst")
        sg.add_edge("clear", END)

        return sg.compile()

    def _make_analyst_wrapper(self, analyst_type, subgraph):
        """Create a parent-graph node that invokes an analyst subgraph."""
        report_key = REPORT_KEY_MAP[analyst_type]

        def wrapper(state):
            sub_input = {
                "messages": [("human", state["company_of_interest"])],
                "company_of_interest": state["company_of_interest"],
                "trade_date": state["trade_date"],
                "report": "",
            }
            result = subgraph.invoke(sub_input)
            return {report_key: result.get("report", "")}

        return wrapper

    def setup_graph(
        self, selected_analysts=["market", "social", "news", "fundamentals"]
    ):
        """Set up and compile the agent workflow graph.

        Args:
            selected_analysts (list): List of analyst types to include. Options are:
                - "market": Market analyst
                - "social": Social media analyst
                - "news": News analyst
                - "fundamentals": Fundamentals analyst
        """
        if len(selected_analysts) == 0:
            raise ValueError("Trading Agents Graph Setup Error: no analysts selected!")

        # Create analyst nodes and their subgraphs
        analyst_creators = {
            "market": lambda: create_market_analyst(self.quick_thinking_llm, self.toolkit),
            "social": lambda: create_social_media_analyst(self.quick_thinking_llm, self.toolkit),
            "news": lambda: create_news_analyst(self.quick_thinking_llm, self.toolkit),
            "fundamentals": lambda: create_fundamentals_analyst(self.quick_thinking_llm, self.toolkit),
        }

        # Create researcher and manager nodes
        bull_researcher_node = create_bull_researcher(
            self.quick_thinking_llm, self.bull_memory
        )
        bear_researcher_node = create_bear_researcher(
            self.quick_thinking_llm, self.bear_memory
        )
        research_manager_node = create_research_manager(
            self.deep_thinking_llm, self.invest_judge_memory
        )
        trader_node = create_trader(self.deep_thinking_llm, self.trader_memory)

        # Create risk analysis nodes
        risky_analyst = create_risky_debator(self.quick_thinking_llm)
        neutral_analyst = create_neutral_debator(self.quick_thinking_llm)
        safe_analyst = create_safe_debator(self.quick_thinking_llm)
        risk_manager_node = create_risk_manager(
            self.deep_thinking_llm, self.risk_manager_memory
        )

        # Create workflow
        workflow = StateGraph(AgentState)

        # Build analyst subgraphs and add wrapper nodes (run in parallel)
        for analyst_type in selected_analysts:
            analyst_node = analyst_creators[analyst_type]()
            tool_node = self.tool_nodes[analyst_type]
            subgraph = self._build_analyst_subgraph(analyst_type, analyst_node, tool_node)
            wrapper = self._make_analyst_wrapper(analyst_type, subgraph)
            workflow.add_node(f"{analyst_type.capitalize()} Analyst", wrapper)

        # Add other nodes
        workflow.add_node("Bull Researcher", bull_researcher_node)
        workflow.add_node("Bear Researcher", bear_researcher_node)
        workflow.add_node("Research Manager", research_manager_node)
        workflow.add_node("Trader", trader_node)
        workflow.add_node("Risky Analyst", risky_analyst)
        workflow.add_node("Neutral Analyst", neutral_analyst)
        workflow.add_node("Safe Analyst", safe_analyst)
        workflow.add_node("Risk Judge", risk_manager_node)

        # Fan-out: START -> all analyst wrappers (parallel execution)
        for analyst_type in selected_analysts:
            workflow.add_edge(START, f"{analyst_type.capitalize()} Analyst")

        # Fan-in: all analyst wrappers -> Bull Researcher
        for analyst_type in selected_analysts:
            workflow.add_edge(f"{analyst_type.capitalize()} Analyst", "Bull Researcher")

        # Research debate edges
        workflow.add_conditional_edges(
            "Bull Researcher",
            self.conditional_logic.should_continue_debate,
            {
                "Bear Researcher": "Bear Researcher",
                "Research Manager": "Research Manager",
            },
        )
        workflow.add_conditional_edges(
            "Bear Researcher",
            self.conditional_logic.should_continue_debate,
            {
                "Bull Researcher": "Bull Researcher",
                "Research Manager": "Research Manager",
            },
        )
        workflow.add_edge("Research Manager", "Trader")
        workflow.add_edge("Trader", "Risky Analyst")
        workflow.add_conditional_edges(
            "Risky Analyst",
            self.conditional_logic.should_continue_risk_analysis,
            {
                "Safe Analyst": "Safe Analyst",
                "Risk Judge": "Risk Judge",
            },
        )
        workflow.add_conditional_edges(
            "Safe Analyst",
            self.conditional_logic.should_continue_risk_analysis,
            {
                "Neutral Analyst": "Neutral Analyst",
                "Risk Judge": "Risk Judge",
            },
        )
        workflow.add_conditional_edges(
            "Neutral Analyst",
            self.conditional_logic.should_continue_risk_analysis,
            {
                "Risky Analyst": "Risky Analyst",
                "Risk Judge": "Risk Judge",
            },
        )

        workflow.add_edge("Risk Judge", END)

        # Compile and return
        return workflow.compile()
