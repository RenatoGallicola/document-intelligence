from schemas.competitor_report import CompetitorReportSchema
import json

def build_prompt(schema_class) -> str:
    """
    Build an extraction prompt that includes the exact JSON schema.
    Forces the model to use the exact field names defined in the schema.
    """
    schema = schema_class.model_json_schema()
    schema_str = json.dumps(schema, indent=2)

    return f"""
You are analyzing a financial report from a competitor in the professional tools and construction equipment industry.

Extract information from the document and return a JSON object that strictly follows the schema below.
Use EXACTLY the field names defined in the schema — no variations, no synonyms.
If a field is not present or cannot be reliably inferred, return null for that field.
Do not invent or estimate values — only extract what is explicitly stated or clearly implied.

Rules:
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
- confidence:
    "high" if data is explicitly labeled and unambiguous
    "medium" if data requires interpretation or segment mapping
    "low" if data is inferred or uncertain
- extraction_notes: flag ambiguities, unusual structures, or important caveats

JSON Schema to follow exactly:
{schema_str}

Return only valid JSON, no prose, no markdown backticks.
"""


DOCUMENT_TYPES = {
    "competitor_report": {
        "schema": CompetitorReportSchema,
        "prompt": build_prompt(CompetitorReportSchema),
        "model": "gemini-3.5-flash",
        "storage_table": "competitor_signals",
    },
    "internal_report": {
        "schema": None,
        "prompt": None,
        "model": "azure_openai",
        "storage_table": "internal_signals",
    },
    "market_report": {
        "schema": None,
        "prompt": None,
        "model": "gemini-3.5-flash",
        "storage_table": "market_signals",
    },
}