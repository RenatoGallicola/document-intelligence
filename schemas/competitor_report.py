from pydantic import BaseModel, Field, model_validator
from typing import Optional
from enum import Enum


class ConfidenceLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class GuidanceDirection(str, Enum):
    RAISED = "raised"
    LOWERED = "lowered"
    MAINTAINED = "maintained"
    NOT_PROVIDED = "not_provided"


class SignalDirection(str, Enum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class EvidencedValue(BaseModel):
    value: Optional[float] = Field(None, description="Extracted numeric value")
    evidence: Optional[str] = Field(None, description="Exact location and quote from the document, e.g. 'Page 8, Financial Summary table, Net Sales row: $15,130.4 million'")

    @model_validator(mode="before")
    @classmethod
    def coerce_scalar(cls, v):
        if isinstance(v, (int, float)):
            return {"value": float(v), "evidence": None}
        return v


class EvidencedStr(BaseModel):
    value: Optional[str] = Field(None, description="Extracted text value")
    evidence: Optional[str] = Field(None, description="Exact location and quote from the document")

    @model_validator(mode="before")
    @classmethod
    def coerce_scalar(cls, v):
        if isinstance(v, str):
            return {"value": v, "evidence": None}
        return v


class SegmentData(BaseModel):
    segment_name: str = Field(description="Segment name as reported by the company")
    revenue: Optional[EvidencedValue] = Field(None, description="Segment revenue in millions")
    yoy_growth_pct: Optional[EvidencedValue] = Field(None, description="Reported YoY revenue growth as decimal (0.05 = +5%)")
    organic_growth_pct: Optional[EvidencedValue] = Field(None, description="Organic YoY growth as decimal, excluding FX and M&A effects")
    operating_margin_pct: Optional[EvidencedValue] = Field(None, description="Segment operating margin as decimal")


class RegionalData(BaseModel):
    region: str = Field(description="Region name as reported by the company, e.g. 'Americas', 'Europe', 'Asia Pacific'")
    revenue: Optional[EvidencedValue] = Field(None, description="Regional revenue in millions")
    yoy_growth_pct: Optional[EvidencedValue] = Field(None, description="Reported YoY revenue growth as decimal")
    organic_growth_pct: Optional[EvidencedValue] = Field(None, description="Organic YoY growth as decimal, excluding FX and M&A effects")
    signal: Optional[SignalDirection] = Field(None, description="Overall demand signal for this region: positive, neutral, or negative")
    commentary: Optional[str] = Field(None, description="Management commentary on this region's performance or outlook, max 1-2 sentences")


class CompetitorReportSchema(BaseModel):

    # --- identifiers ---
    competitor_name: Optional[str] = Field(None, description="Company name, e.g. 'Stanley Black & Decker'")
    ticker: Optional[str] = Field(None, description="Stock exchange ticker, e.g. 'SWK', 'TTI', '6584.T'")
    report_period: Optional[str] = Field(None, description="Reporting period, e.g. 'FY2024', 'Q1 2025'")
    period_end_date: Optional[str] = Field(None, description="Period end date in ISO format, e.g. '2024-12-31'")
    report_type: Optional[str] = Field(None, description="Type of report, e.g. 'annual report', 'earnings release', '10-K', 'quarterly results'")
    report_currency: Optional[str] = Field(None, description="Currency used for financial figures, e.g. 'USD', 'EUR', 'JPY'")

    # --- company-level financials ---
    total_revenue: Optional[EvidencedValue] = Field(None, description="Total company revenue in millions")
    total_revenue_yoy_growth_pct: Optional[EvidencedValue] = Field(None, description="Reported total revenue YoY growth as decimal, including FX and M&A effects")
    total_revenue_organic_growth_pct: Optional[EvidencedValue] = Field(None, description="Organic revenue growth as decimal, excluding FX translation and M&A. Only extract if explicitly stated — do not calculate.")
    fx_impact_pct: Optional[EvidencedValue] = Field(None, description="FX translation impact on revenue growth as decimal (negative = headwind, e.g. -0.03 = -3pp drag)")
    m_and_a_impact_pct: Optional[EvidencedValue] = Field(None, description="M&A contribution to revenue growth as decimal (positive = acquired growth, negative = divested revenue). Excludes FX and organic. Only extract if explicitly stated.")
    gross_margin_pct: Optional[EvidencedValue] = Field(None, description="Gross margin as decimal")
    operating_margin_pct: Optional[EvidencedValue] = Field(None, description="Operating (EBIT) margin as decimal")
    ebitda_margin_pct: Optional[EvidencedValue] = Field(None, description="EBITDA margin as decimal. Use adjusted EBITDA if reported.")

    # --- tools / construction-comparable segment ---
    tools_segment_name: Optional[str] = Field(None, description="Name used by this company for the segment most comparable to the reference company's core business, e.g. 'Tools & Outdoor', 'Power Tools', 'Professional Tools & Equipment'")
    tools_segment_revenue: Optional[EvidencedValue] = Field(None, description="Revenue of the tools/construction segment in millions")
    tools_segment_yoy_growth_pct: Optional[EvidencedValue] = Field(None, description="Reported YoY growth of the tools segment as decimal")
    tools_segment_organic_growth_pct: Optional[EvidencedValue] = Field(None, description="Organic YoY growth of the tools segment as decimal. Only extract if explicitly stated.")
    tools_segment_margin_pct: Optional[EvidencedValue] = Field(None, description="Operating margin of the tools segment as decimal")
    professional_revenue: Optional[EvidencedValue] = Field(None, description="Revenue attributable specifically to professional/commercial end users in millions, if separately disclosed (e.g. SBD 'Professional' sub-segment)")
    professional_vs_diy_mix: Optional[EvidencedStr] = Field(None, description="Description of professional vs. consumer/DIY revenue split if reported, e.g. '60% professional, 40% consumer'")

    # --- order dynamics ---
    order_intake_mln: Optional[EvidencedValue] = Field(None, description="Order intake / new orders received in the period in millions. Relevant for capital goods / order-based companies (e.g. Atlas Copco). Leave null if not reported.")
    order_backlog_mln: Optional[EvidencedValue] = Field(None, description="Order backlog / order book at period end in millions. Leave null if not reported.")

    # --- all segments ---
    segment_breakdown: list[SegmentData] = Field(default_factory=list, description="All business segments reported by the company with available financials")

    # --- regional breakdown ---
    regional_breakdown: list[RegionalData] = Field(default_factory=list, description="Revenue and growth by geographic region, using the company's own regional structure")

    # --- qualitative demand signals ---
    construction_demand_signal: Optional[EvidencedStr] = Field(None, description="Management commentary on overall construction market conditions, max 2 sentences")
    professional_demand_signal: Optional[EvidencedStr] = Field(None, description="Commentary specific to professional/industrial tool demand, distinct from consumer/DIY, max 2 sentences")
    volume_vs_price: Optional[EvidencedStr] = Field(None, description="Decomposition of revenue growth into volume and price components, e.g. 'volume +3%, price +2%'")
    pricing_commentary: Optional[EvidencedStr] = Field(None, description="Commentary on pricing power, price increases or decreases taken, competitive pricing environment")
    inventory_dynamics: Optional[EvidencedStr] = Field(None, description="Channel inventory levels, destocking or restocking commentary, e.g. 'distributors completed destocking in Q3'")

    # --- guidance ---
    guidance_revenue_growth_low_pct: Optional[EvidencedValue] = Field(None, description="Low end of revenue growth guidance range as decimal. If single-point guidance, use same value as high.")
    guidance_revenue_growth_high_pct: Optional[EvidencedValue] = Field(None, description="High end of revenue growth guidance range as decimal. If single-point guidance, use same value as low.")
    guidance_direction: GuidanceDirection = Field(GuidanceDirection.NOT_PROVIDED, description="Whether guidance was raised, lowered, maintained, or not provided vs. prior guidance")
    guidance_narrative: Optional[EvidencedStr] = Field(None, description="Key forward-looking statements from management, max 2 sentences")

    # --- metadata ---
    confidence: ConfidenceLevel = Field(ConfidenceLevel.LOW)
    extraction_notes: Optional[str] = Field(None, description="Ambiguities, caveats, data gaps, or important context for this extraction")
