from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from tradingagents.agents.utils.agent_utils import ensure_str
import time
import json


def create_news_analyst(llm, toolkit):
    def news_analyst_node(state):
        current_date = state["trade_date"]
        ticker = state["company_of_interest"]

        if toolkit.config["online_tools"]:
            tools = [toolkit.get_global_news_openai, toolkit.get_google_news]
        else:
            tools = [
                toolkit.get_finnhub_news,
                toolkit.get_reddit_news,
                toolkit.get_google_news,
            ]

        system_message = (
            "You are a news researcher tasked with analyzing recent news and trends over the past week. Please write a comprehensive report of the current state of the world that is relevant for trading and macroeconomics. Look at news from EODHD, and finnhub to be comprehensive. Do not simply state the trends are mixed, provide detailed and finegrained analysis and insights that may help traders make decisions."
            + """ Structure your report with clear Markdown headings (##, ###), bullet points for key events, and append a summary Markdown table at the end with columns: Event/Topic, Impact (Positive/Negative/Neutral), Relevance to Trading. Be thorough and do not cut your analysis short."""
            + """

Your report MUST end with a ## Forward Outlook section containing:
- **Scheduled catalysts (next 30-60 days)**: list specific upcoming events with approximate dates — Fed/FOMC meetings, earnings releases, economic data prints (CPI, NFP, GDP), regulatory decisions, geopolitical flashpoints. State the expected market impact of each.
- **Macro trajectory**: are the dominant macro forces (rates, inflation, growth, geopolitics) strengthening, weakening, or shifting direction? What is the most likely macro regime for the next 30 days?
- **Key risk event**: the single upcoming event most likely to cause a significant market move or reverse the current trend. Explain why.
- **Directional macro bias**: state Bullish / Bearish / Neutral on the macro environment and a confidence level (High / Medium / Low) with one sentence of justification."""
        )

        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You are a helpful AI assistant, collaborating with other assistants."
                    " Use the provided tools to progress towards answering the question."
                    " If you are unable to fully answer, that's OK; another assistant with different tools"
                    " will help where you left off. Execute what you can to make progress."
                    " If you or any other assistant has the FINAL TRANSACTION PROPOSAL: **BUY/HOLD/SELL** or deliverable,"
                    " prefix your response with FINAL TRANSACTION PROPOSAL: **BUY/HOLD/SELL** so the team knows to stop."
                    " You have access to the following tools: {tool_names}.\n{system_message}"
                    "For your reference, the current date is {current_date}. We are looking at the company {ticker}",
                ),
                MessagesPlaceholder(variable_name="messages"),
            ]
        )

        prompt = prompt.partial(system_message=system_message)
        prompt = prompt.partial(tool_names=", ".join([tool.name for tool in tools]))
        prompt = prompt.partial(current_date=current_date)
        prompt = prompt.partial(ticker=ticker)

        chain = prompt | llm.bind_tools(tools)
        result = chain.invoke(state["messages"])

        report = ""

        if len(result.tool_calls) == 0:
            report = ensure_str(result.content)

        return {
            "messages": [result],
            "news_report": report,
        }

    return news_analyst_node
