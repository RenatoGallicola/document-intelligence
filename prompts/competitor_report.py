COMPETITOR_REPORT_INSTRUCTIONS = """
Domain rules for competitor financial reports (Example Corp competitive intelligence):

NUMERIC CONVENTIONS
- Revenue: extract in millions, in the currency stated in report_currency
- Growth rates: extract as decimal (0.05 = +5%, -0.03 = -3%)
- Margins: extract as decimal (0.42 = 42%)
- If a monetary value is not stated but can be derived from a stated total and a stated percentage
  breakdown, calculate it (e.g. segment_revenue = total_revenue × stated_pct) and set confidence
  to "medium". Always prefer a calculated value over null.

PROXY AND FALLBACK VALUES
- Always prefer a populated value over null. If exact data for a field is unavailable, use the
  best available proxy and document it clearly in extraction_notes.
- tools_segment_*: if the exact division is not separately disclosed (e.g. it is nested inside a
  larger reporting segment), use the parent segment as a proxy. Set tools_segment_name to
  "<ParentSegmentName> (proxy for <ActualDivisionName>)" and explain the proxy in extraction_notes.
- Exception — *_organic_growth_pct: NEVER calculate or infer. Only populate if the company
  explicitly labels it as organic, like-for-like, constant-currency, or LFL growth.

FX IMPACT
- fx_impact_pct: look for "foreign exchange headwind/tailwind of X%" or "currency impact of X bps".
  Convert basis points to decimal (300bps = 0.03). Negative means headwind (drag on growth).

M&A IMPACT
- m_and_a_impact_pct: look for "acquisition contribution of X%", "M&A impact of X pp",
  "portfolio changes added/removed X pp from growth", or similar phrasing.
- Positive = inorganic growth from acquisitions. Negative = revenue lost from divestitures.
- Only extract if explicitly stated — do not calculate from reported minus organic minus FX.

ORDER DYNAMICS
- order_intake_mln / order_backlog_mln: extract only for companies that report an order book
  (e.g. Atlas Copco, industrial equipment companies). Leave null for distribution-model companies
  like SBD, Makita, or Bosch that do not report order intake as a metric.
- order_intake is a 1-2 quarter leading indicator of future revenue — capture it carefully.

TOOLS SEGMENT MAPPING
- Map the segment most comparable to Example Corp's business (professional power tools, anchors, fastening,
  measuring systems) to tools_segment_*.
  Reference mappings (use as a guide, not as fixed rules — company structures change over time):
    Stanley Black & Decker → "Tools & Outdoor" (or successor segment post-restructuring)
    TTI / Milwaukee → "Power Equipment" or full company (TTI is tools-only)
    Makita → full company (tools-only company)
    Bosch → "Power Tools" division (nested under Consumer Goods sector)
    ITW → "Construction Products" segment
    Atlas Copco → "Power Technique" or "Tools & Assembly Solutions"
- If the exact division is not separately reported, apply the proxy rule above.
- Record the exact name (or proxy name) in tools_segment_name.

PROFESSIONAL vs. DIY
- professional_revenue: only populate if the company separately discloses professional-end revenue.
  SBD splits "Professional" and "Consumer" within Tools & Outdoor — use Professional sub-segment.
  TTI does not split; leave null.
- professional_vs_diy_mix: include any stated percentage or qualitative description of the split.

REGIONAL BREAKDOWN
- Use the company's own regional names — do not translate to Example Corp regions.
- Include revenue and growth for each region if disclosed.
- signal: infer from growth data — positive if organic growth > 0, negative if < 0, neutral if flat or mixed.
- If only qualitative commentary exists for a region (no numbers), still create a RegionalData entry
  with revenue and growth_pct null, and set the signal based on the commentary.
- commentary: capture any management quote or statement about this region's conditions or outlook,
  max 1-2 sentences. Leave null only if no regional commentary exists.

QUALITATIVE SIGNALS
- construction_demand_signal: focus on non-residential and infrastructure construction. Ignore residential
  unless specifically mentioned as relevant to tools demand.
- volume_vs_price: look for explicit breakdowns in earnings call transcripts or MD&A sections.
  Phrasing: "volume contributed X%, price/mix Y%", "organic growth driven by price".
- inventory_dynamics: look for "channel inventory", "distributor inventory", "destocking", "inventory
  normalization", "sell-in vs. sell-out". This is a leading indicator — capture it carefully.
- pricing_commentary: record any mention of price increases, surcharges, or pricing pressure from competition.

GUIDANCE
- guidance_revenue_growth_low_pct / high_pct: extract the growth rate guidance range.
  If stated as absolute revenue range, calculate growth vs. prior year revenue.
  If single point (e.g. "we expect ~3% growth"), set both low and high to that value.
- guidance_direction: compare to previously stated guidance for the same period.
  Mark "lowered" if full-year revenue guidance midpoint decreased vs. prior guidance,
  even if not explicitly called out.

CONFIDENCE
- high: data explicitly labeled, directly readable from tables or stated figures
- medium: calculated, inferred, or from non-primary sources (analyst Q&A, footnotes)
- low: estimated, ambiguous, or covering incomplete data
"""
