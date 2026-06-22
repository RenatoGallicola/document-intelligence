COMPETITOR_REPORT_INSTRUCTIONS = """
Domain rules for competitor financial reports (Example Corp competitive intelligence):

NUMERIC CONVENTIONS
- Revenue: extract in millions, in the currency stated in report_currency
- Growth rates: extract as decimal (0.05 = +5%, -0.03 = -3%)
- Margins: extract as decimal (0.42 = 42%)
- If an exact figure is not stated but can be calculated from stated percentages and a known base,
  calculate it and set confidence to "medium". Always prefer calculated over null.

ORGANIC GROWTH
- Only populate *_organic_growth_pct if the company explicitly states it — do not derive it yourself.
- Common labels: "organic growth", "like-for-like growth", "constant-currency growth", "LFL".
- If organic growth is stated only for the full company (not per segment), leave segment-level organic null.

FX IMPACT
- fx_impact_pct: look for "foreign exchange headwind/tailwind of X%" or "currency impact of X bps".
  Convert basis points to decimal (300bps = 0.03). Negative means headwind (drag on growth).

TOOLS SEGMENT MAPPING
- Map the segment most comparable to Example Corp's business (professional power tools, anchors, fastening,
  measuring systems) to tools_segment_*.
  Common mappings:
    Stanley Black & Decker → "Tools & Outdoor" (or its successor segment post-restructuring)
    TTI / Milwaukee → "Power Equipment" or full company (TTI is tools-only)
    Makita → full company revenue (Makita is tools-only)
    Bosch → "Power Tools" division
    ITW → "Construction Products" segment
    Atlas Copco → "Power Technique" or "Tools & Assembly Solutions"
- Record the exact name in tools_segment_name.

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
