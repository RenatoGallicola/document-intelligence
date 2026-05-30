# document-intelligence

> Extract structured data from any PDF — financial reports, market research, internal documents — using LLM-powered pipelines with validated schemas.

---

## What it does

`document-intelligence` takes heterogeneous PDF documents (annual reports, investor presentations, market briefs, internal reviews) and extracts structured, validated JSON according to a schema you define. It handles mixed layouts, tables, charts, and narrative text without manual parsing.

---

## How it works

```
PDF (any format)
      ↓
Gemini vision model reads the document
      ↓
Extracts fields defined in your schema
      ↓
Pydantic validates the output
      ↓
Structured JSON saved locally or to a Delta table
```

Each document type has its own **schema** (what to extract) and **prompt** (how to extract it). The core pipeline is generic and never changes.

---

## Project structure

```
document-intelligence/
│
├── core/
│   └── prompt_builder.py        # generic prompt builder for any schema
│
├── schemas/
│   ├── competitor_report.py     # Pydantic schema — competitor financial reports
│   ├── internal_report.py       # placeholder
│   └── market_report.py         # placeholder
│
├── prompts/
│   ├── competitor_report.py     # domain-specific extraction rules
│   ├── internal_report.py       # placeholder
│   └── market_report.py         # placeholder
│
├── input/                       # drop PDFs here
├── output/                      # extracted JSON files saved here
├── utils/                       # diagnostic scripts (list_models, test_api)
│
├── config.py                    # document type registry
├── extractor.py                 # Gemini API call + response parsing
├── validator.py                 # Pydantic validation + summary
├── storage.py                   # local JSON and Delta table storage
└── pipeline.py                  # orchestration + CLI
```

---

## Quickstart

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/document-intelligence.git
cd document-intelligence
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux
pip install -r requirements.txt
```

### 2. Set your API key

Create a `.env` file in the project root:

```
GEMINI_API_KEY=your_key_here
```

Get a free API key at [aistudio.google.com](https://aistudio.google.com).

### 3. Run

```bash
# process all PDFs in input/
python pipeline.py

# process a specific file
python pipeline.py input/report.pdf

# process multiple files
python pipeline.py input/report_a.pdf input/report_b.pdf

# use a different document type
python pipeline.py --type market_report input/report.pdf
```

Extracted JSON files are saved to `output/`.

---

## Adding a new document type

Three steps — no changes to the core pipeline.

**1. Define the schema** in `schemas/your_type.py`:

```python
from pydantic import BaseModel, Field
from typing import Optional

class YourSchema(BaseModel):
    title: Optional[str] = Field(None, description="Document title")
    summary: Optional[str] = Field(None, description="Executive summary, max 3 sentences")
    key_findings: list[str] = Field(default_factory=list)
    confidence: str = Field("low")
    extraction_notes: Optional[str] = Field(None)
```

**2. Write the domain instructions** in `prompts/your_type.py`:

```python
YOUR_TYPE_INSTRUCTIONS = """
Domain-specific rules for this document type:
- key_findings: extract only explicitly stated conclusions, not inferences
- summary: prioritize quantitative statements over qualitative ones
"""
```

**3. Register the document type** in `config.py`:

```python
from schemas.your_type import YourSchema
from prompts.your_type import YOUR_TYPE_INSTRUCTIONS

DOCUMENT_TYPES = {
    ...
    "your_type": {
        "schema": YourSchema,
        "prompt": build_prompt(YourSchema, YOUR_TYPE_INSTRUCTIONS),
        "model": "gemini-3.5-flash",
        "storage_table": "your_table",
    },
}
```

That's it. Run with `python pipeline.py --type your_type input/doc.pdf`.

---

## Supported models

The model is configurable per document type in `config.py`. Any model available via the Google GenAI API works. To list models available to your API key:

```bash
python utils/list_models.py
```

For documents containing sensitive internal data, replace the model with an Azure OpenAI endpoint or any API-compatible model running within your security perimeter.

---

## Output format

Each processed document produces a JSON file in `output/` 
named `{source_pdf_name}_{timestamp}.json`. Example output for a competitor financial report:

```json
{
  "competitor_name": "Stanley Black & Decker, Inc.",
  "report_period": "FY2025",
  "report_type": "annual report",
  "report_currency": "USD",
  "total_revenue": 15130.4,
  "total_revenue_yoy_growth_pct": -0.0153,
  "gross_margin_pct": 0.303,
  "tools_segment_revenue": 13158.2,
  "tools_segment_yoy_growth_pct": -0.011,
  "tools_segment_name": "Tools & Outdoor",
  "regional_signals": [
    { "region": "Europe", "signal": "positive", "evidence": "Net sales increased 2.04% YoY." },
    { "region": "North America", "signal": "negative", "evidence": "Net sales declined 2.0% YoY." }
  ],
  "macro_construction_commentary": "Soft market backdrop with mid-year tariff-related disruptions.",
  "guidance_direction": "not_provided",
  "confidence": "high",
  "extraction_notes": "Operating margin not reported at consolidated level."
}
```

---

## Requirements

- Python 3.9+
- Google GenAI API key (free tier available)
- See `requirements.txt` for Python dependencies

---

## License

MIT