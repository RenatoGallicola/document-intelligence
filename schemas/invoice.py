from pydantic import BaseModel, Field, model_validator
from typing import Optional


class EvidencedValue(BaseModel):
    value: Optional[float] = Field(None, description="Extracted numeric value")
    evidence: Optional[str] = Field(None, description="Exact quote and location from the document")

    @model_validator(mode="before")
    @classmethod
    def coerce_scalar(cls, v):
        if isinstance(v, (int, float)):
            return {"value": float(v), "evidence": None}
        return v

class LineItems(BaseModel):
    description: Optional[str] = Field(None, description="Description of the product or service billed")
    quantity: Optional[float] = Field(None, description="Quantity billed")
    unit_price: Optional[EvidencedValue] = Field(None, description="Price per unit")
    amount: Optional[EvidencedValue] = Field(None, description="Line total (quantity x unit price)")

class InvoiceSchema(BaseModel):
    vendor_name: Optional[str] = Field(None, description="Name of the company or person issuing the invoice")
    invoice_number: Optional[str] = Field(None, description="Invoice or reference number")
    invoice_date: Optional[str] = Field(None, description="Date the invoice was issued, ISO format if possible")
    due_date: Optional[str] = Field(None, description="Payment due date, ISO format if possible")
    currency: Optional[str] = Field(None, description="Currency code used on the invoice, e.g. USD, EUR")
    total_amount: Optional[EvidencedValue] = Field(None, description="Total amount due including tax")
    line_items: list[LineItems] = Field(default_factory=list, description="Individual line items billed on the invoice")
    confidence: Optional[str] = Field(None, description="Extraction confidence: high, medium, or low")
    extraction_notes: Optional[str] = Field(None, description="Ambiguities, caveats, or important context for this extraction")
