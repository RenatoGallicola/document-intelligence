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


class RegionalSignal(BaseModel):
    region: str = Field(description="Geographic region or country mentioned")
    signal: SignalDirection
    evidence: str = Field(description="Direct quote or paraphrase from the document")


class CompetitorReportSchema(BaseModel):
    # identifiers
    competitor_name: Optional[str] = Field(None, description="Company name")
    report_period: Optional[str] = Field(None, description="e.g. Q1 2025, FY2024")
    report_type: Optional[str] = Field(None, description="e.g. earnings release, annual report, investor presentation")

    # financials
    tools_segment_revenue: Optional[float] = Field(None, description="Revenue of the tools or construction segment in millions")
    tools_segment_currency: Optional[str] = Field(None, description="Currency of the revenue figure")
    tools_segment_yoy_growth_pct: Optional[float] = Field(None, description="Year-over-year growth as decimal, e.g. 0.05 for 5%")
    gross_margin_pct: Optional[float] = Field(None, description="Gross margin as decimal")
    inventory_days: Optional[float] = Field(None, description="Days of inventory on hand if reported")

    # qualitative signals
    geographic_commentary: Optional[str] = Field(None, description="Commentary on geographic performance, max 3 sentences")
    demand_outlook: Optional[str] = Field(None, description="Forward-looking demand commentary, max 2 sentences")
    regional_signals: list[RegionalSignal] = Field(default_factory=list)
    guidance_direction: GuidanceDirection = Field(GuidanceDirection.NOT_PROVIDED)
    macro_construction_commentary: Optional[str] = Field(None, description="Any mention of construction market conditions")

    # metadata
    confidence: ConfidenceLevel = Field(ConfidenceLevel.LOW)
    extraction_notes: Optional[str] = Field(None, description="Any ambiguities or issues encountered during extraction")