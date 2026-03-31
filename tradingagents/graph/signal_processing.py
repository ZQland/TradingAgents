# TradingAgents/graph/signal_processing.py

import re


class SignalProcessor:
    """Processes trading signals to extract actionable decisions."""

    def process_signal(self, full_signal: str) -> str:
        """
        Extract the core BUY/SELL/HOLD decision from a trading signal using
        pattern matching. No LLM call required.

        Tries patterns in priority order:
          1. Recommendation header  e.g. "Recommendation: HOLD" or "### **Recommendation: SELL**"
          2. Inline recommendation  e.g. "recommendation is to **SELL**"
          3. Inline decision        e.g. "decision is to BUY"
          4. Standalone bold word   e.g. "**SELL**" (skips analyst-summary parens like "(BUY)")
          5. Word-frequency fallback across the full text

        Args:
            full_signal: Complete trading signal text from the risk manager.

        Returns:
            Extracted decision: "BUY", "SELL", or "HOLD".
        """
        upper = full_signal.upper()

        # 1. Recommendation header: "Recommendation: HOLD" / "Recommendation: **SELL**"
        m = re.search(r'RECOMMENDATION[:\s]+\**\s*(BUY|SELL|HOLD)', upper)
        if m:
            return m.group(1)

        # 2. "recommendation is to SELL" / "recommendation is to **SELL**"
        m = re.search(r'RECOMMENDATION\s+IS\s+(?:TO\s+)?\**\s*(BUY|SELL|HOLD)', upper)
        if m:
            return m.group(1)

        # 3. "decision is to BUY" / "my decision is to **SELL**"
        m = re.search(r'DECISION\s+IS\s+(?:TO\s+)?\**\s*(BUY|SELL|HOLD)', upper)
        if m:
            return m.group(1)

        # 4. Standalone bold word **SELL** — skip if immediately preceded by "(" to
        #    avoid matching analyst summaries like "Risky Analyst (BUY)"
        for m in re.finditer(r'\*\*(BUY|SELL|HOLD)\*\*', upper):
            if m.start() > 0 and full_signal[m.start() - 1] == '(':
                continue
            return m.group(1)

        # 5. Word-frequency fallback
        counts = {
            'BUY': len(re.findall(r'\bBUY\b', upper)),
            'SELL': len(re.findall(r'\bSELL\b', upper)),
            'HOLD': len(re.findall(r'\bHOLD\b', upper)),
        }
        return max(counts, key=counts.get)

    def process_confidence(self, full_signal: str) -> int:
        """
        Extract the confidence score from the risk manager's final decision text.
        Looks for pattern: "Confidence Score: XX/100"
        Returns an integer 0-100, defaults to 50 if not found.
        """
        m = re.search(r'Confidence Score:\s*(\d{1,3})/100', full_signal, re.IGNORECASE)
        if m:
            score = int(m.group(1))
            return max(0, min(100, score))
        return 50
