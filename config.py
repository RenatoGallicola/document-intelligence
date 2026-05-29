from schemas.competitor_report import CompetitorReportSchema

EXTRACTION_PROMPT_COMPETITOR = """
You are analyzing a financial report from a competitor in the professional tools and construction equipment industry.

Extract the following information and return a valid JSON object. 
If a field is not present or cannot be reliably inferred, return null for that field.
Do not invent or estimate values — only extract what is explicitly stated or clearly implied.

Rules:
- Revenue values: extract as a number in millions, note the currency separately
- YoY growth: extract as decimal (0.05 for 5%, -0.03 for -3%)
- Margins: extract as decimal (0.42 for 42%)
- regional_signals: list of regions explicitly mentioned with a positive, neutral, or negative demand signal
- confidence: 
    "high" if the data is explicitly labeled and unambiguous
    "medium" if the data requires interpretation or matching to a segment
    "low" if the data is inferred or uncertain
- extraction_notes: use this field to flag any ambiguities, missing segments, or unusual report structures

Return only valid JSON, no prose, no markdown backticks.
"""


DOCUMENT_TYPES = {
    "competitor_report": {
        "schema": CompetitorReportSchema,
        "prompt": EXTRACTION_PROMPT_COMPETITOR,
        "model": "gemini-2.0-flash",
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
        "model": "gemini-2.0-flash",
        "storage_table": "market_signals",
    },
}