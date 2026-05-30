from pydantic import BaseModel, Field
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


class RegionalSignal(BaseModel):
    region: str = Field(description="Geographic region or country mentioned")
    signal: SignalDirection
    evidence: Optional[str] = Field(None, description="Key data point or quote supporting the signal")


class SegmentData(BaseModel):
    segment_name: str
    revenue: EvidencedValue = Field(default_factory=EvidencedValue, description="Segment revenue in millions")
    yoy_growth_pct: EvidencedValue = Field(default_factory=EvidencedValue, description="YoY growth as decimal")
    operating_margin_pct: EvidencedValue = Field(default_factory=EvidencedValue, description="Operating margin as decimal")


class CompetitorReportSchema(BaseModel):

    # identifiers
    competitor_name: Optional[str] = Field(None, description="Company name")
    report_period: Optional[str] = Field(None, description="Reporting period, e.g. FY2024, Q1 2025")
    report_type: Optional[str] = Field(None, description="Type of report, e.g. annual report, earnings release")
    report_currency: Optional[str] = Field(None, description="Currency used for financial figures, e.g. USD, EUR")

    # company-level financials
    total_revenue: EvidencedValue = Field(default_factory=EvidencedValue, description="Total company revenue in millions")
    total_revenue_yoy_growth_pct: EvidencedValue = Field(default_factory=EvidencedValue, description="Total revenue YoY growth as decimal")
    gross_margin_pct: EvidencedValue = Field(default_factory=EvidencedValue, description="Gross margin as decimal")
    operating_margin_pct: EvidencedValue = Field(default_factory=EvidencedValue, description="Operating margin as decimal")

    # tools/construction segment
    tools_segment_revenue: EvidencedValue = Field(default_factory=EvidencedValue, description="Revenue of the segment most comparable to Example Corp's business in millions")
    tools_segment_yoy_growth_pct: EvidencedValue = Field(default_factory=EvidencedValue, description="YoY growth of the tools segment as decimal")
    tools_segment_margin_pct: EvidencedValue = Field(default_factory=EvidencedValue, description="Operating margin of the tools segment as decimal")
    tools_segment_name: Optional[str] = Field(None, description="Name used by this company for the tools segment")

    # all segments
    segment_breakdown: list[SegmentData] = Field(default_factory=list, description="All business segments reported")

    # qualitative signals
    regional_signals: list[RegionalSignal] = Field(default_factory=list, description="Regional demand signals")
    macro_construction_commentary: Optional[str] = Field(None, description="Construction market conditions, max 2 sentences")
    guidance_direction: GuidanceDirection = Field(GuidanceDirection.NOT_PROVIDED)
    guidance_details: Optional[str] = Field(None, description="Specific guidance figures or commentary, max 2 sentences")

    # metadata
    confidence: ConfidenceLevel = Field(ConfidenceLevel.LOW)
    extraction_notes: Optional[str] = Field(None, description="Ambiguities, caveats, or important context")