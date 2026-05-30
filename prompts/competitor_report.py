COMPETITOR_REPORT_INSTRUCTIONS = """
Domain-specific rules for competitor financial reports:
- Revenue values: extract as a number in millions, note the currency in report_currency
- YoY growth: extract as decimal (0.05 for 5%, -0.03 for -3%)
- Margins: extract as decimal (0.42 for 42%)
- tools_segment_*: map the segment most comparable to Example Corp's business to these fields.
  Example Corp sells professional power tools, anchors, measuring systems, and construction fastening.
  Common mappings: "Tools & Outdoor" (SBD), "Power Tools" (Bosch), "Professional Tools" (Makita).
  Use tools_segment_name to record what the company actually calls it.
- segment_breakdown: include ALL segments the company reports with available financials
- regional_signals: only include regions explicitly mentioned with supporting data.
  signal must be exactly one of: positive, neutral, negative
  Infer signal from data: growth = positive, decline = negative, flat or mixed = neutral
- guidance_direction: mark as "lowered" if the company forecasts lower revenue OR lower
  profit compared to the current period, even if not explicitly stated as guidance.
- If exact segment revenue is not reported but percentage composition is available,
  calculate the absolute value from total revenue and report it with confidence "medium".
  Always prefer calculated values over null.
"""