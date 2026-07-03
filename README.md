# document-intelligence

> Extract structured, validated data from any PDF using an LLM vision model — through a web app, no code required to add a new document type.

---

## What it does

`document-intelligence` takes a PDF (annual report, earnings release, market brief, internal review) and extracts structured JSON from it according to a schema you define. It handles mixed layouts, tables, charts, and narrative text without manual parsing. Every numeric or claimed field is returned with its source evidence (exact quote and location) for spot verification.

The first use case is extracting competitor financial signals (revenue, margins, regional demand, guidance) from competitors' annual reports and earnings releases, feeding a demand forecasting workflow at Example Corp.

It ships as a local web app — a FastAPI backend and a React frontend — plus a CLI for batch/scripted use.

---

## How it works

```
PDF
  ↓
Gemini vision model reads the document, guided by a JSON-schema-driven prompt
  ↓
Response parsed (with truncation repair) and validated against the schema (Pydantic)
  ↓
Structured JSON saved to output/, viewable and downloadable in the app
```

Each document type has its own **schema** (what to extract) and **prompt** (domain-specific extraction rules). The extraction pipeline itself is generic and never changes — adding a document type never touches it.

---

## The app

Four pages, in the sidebar:

- **Processor** — drag and drop PDFs, pick a document type, extract. Shows live progress and a per-file summary (fields extracted vs. missing, confidence).
- **Output Explorer** — browse every past extraction. Search, group by document type, inspect fields/lists/raw JSON, download one result or all of them as a `.zip`, delete.
- **Schema Manager** — create and edit document types entirely from the UI: name a schema, add fields (text, number, boolean, evidenced value, list, nested object), see the generated Pydantic code live, save. `confidence` and `extraction_notes` are added to every schema automatically. No Python required for the common case.
- **Settings** — Gemini API key, default model (applies globally, to every document type), and light/dark appearance.

---

## Project structure

```
document-intelligence/
│
├── backend/
│   ├── main.py                      # FastAPI app, CORS, router registration
│   └── routers/
│       ├── documents.py             # POST /process, GET/DELETE /outputs
│       ├── schemas.py               # CRUD for document-type schemas (backs Schema Manager)
│       └── settings.py              # API key, default model, model list
│
├── core/
│   └── prompt_builder.py            # generic prompt builder for any schema
│
├── schemas/
│   ├── competitor_report.py         # Pydantic schema — competitor financial reports
│   └── _registry.json               # tracks schemas created via Schema Manager
│
├── prompts/
│   └── competitor_report.py         # domain-specific extraction rules
│
├── frontend/
│   └── src/
│       ├── App.tsx                  # root component, global state, page routing
│       ├── theme/                   # design tokens, shared style factories, light/dark context
│       ├── components/              # Sidebar, ProgressBar
│       └── pages/                   # Processor, OutputExplorer, SchemaManager, Settings
│
├── input/                           # PDF working directory (gitignored)
├── output/                          # extracted JSON files (gitignored)
├── utils/                           # list_models.py, test_api.py
│
├── config.py                        # document type registry
├── extractor.py                     # Gemini call, retry, parse, validate
├── validator.py                     # Pydantic validation + extraction summary
├── storage.py                       # save extraction result to output/
├── pipeline.py                      # orchestration + CLI
│
├── .env                             # GEMINI_API_KEY, DEFAULT_MODEL (gitignored)
└── requirements.txt
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

cd frontend
npm install
```

### 2. Set your API key

Create a `.env` file in the project root:

```
GEMINI_API_KEY=your_key_here
```

Get a free key at [aistudio.google.com](https://aistudio.google.com). You can also paste it later from the Settings page.

### 3. Run

```bash
# terminal 1 — backend
uvicorn backend.main:app --reload

# terminal 2 — frontend
cd frontend
npm run dev
```

- App: [http://localhost:5173](http://localhost:5173)
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

Drop a PDF into the Processor tab, pick a document type, and extract.

---

## Adding a new document type

**From the app (recommended):** open **Schema Manager** → *New schema* → name it, add fields with their type and a description (used to instruct the model), save. This generates the Pydantic schema, a starter prompt, and registers the type — all without touching a file.

**By hand** (for advanced cases — custom validators, enums, cross-field logic): add `schemas/your_type.py` (a Pydantic model ending in `Schema`) and `prompts/your_type.py` (a `YOUR_TYPE_INSTRUCTIONS` string), then register both in `config.py`:

```python
from schemas.your_type import YourTypeSchema
from prompts.your_type import YOUR_TYPE_INSTRUCTIONS

DOCUMENT_TYPES = {
    ...
    "your_type": {
        "schema": YourTypeSchema,
        "prompt": build_prompt(YourTypeSchema, YOUR_TYPE_INSTRUCTIONS),
        "storage_table": "your_table",
    },
}
```

Either way, the type appears automatically in the Processor dropdown.

---

## Model and appearance

The Gemini model is a single global setting (Settings → Model) — it applies to every document type, not per-schema. Change it and save; extraction picks it up immediately, no restart needed.

To see which models your key can access:

```bash
python utils/list_models.py
```

The app supports light and dark themes (Settings → Appearance), persisted locally in the browser.

---

## Output format

Each processed document produces a JSON file in `output/`, named `{source_pdf_name}_{timestamp}.json`. Numeric and claimed fields are wrapped as `{ "value": ..., "evidence": "..." }` so every extracted number can be traced back to its source. Example, trimmed, for a competitor financial report:

```json
{
  "competitor_name": "Stanley Black & Decker, Inc.",
  "report_period": "FY2025",
  "report_type": "annual report",
  "report_currency": "USD",
  "total_revenue": { "value": 15130.4, "evidence": "Page 8, Financial Summary table, Net Sales row: $15,130.4 million" },
  "total_revenue_yoy_growth_pct": { "value": -0.0153, "evidence": "..." },
  "gross_margin_pct": { "value": 0.303, "evidence": "..." },
  "tools_segment_name": "Tools & Outdoor",
  "tools_segment_revenue": { "value": 13158.2, "evidence": "..." },
  "regional_breakdown": [
    { "region": "Europe", "signal": "positive", "commentary": "Net sales increased 2.04% YoY." },
    { "region": "North America", "signal": "negative", "commentary": "Net sales declined 2.0% YoY." }
  ],
  "construction_demand_signal": "Soft market backdrop with mid-year tariff-related disruptions.",
  "guidance_direction": "not_provided",
  "confidence": "high",
  "extraction_notes": "Operating margin not reported at consolidated level."
}
```

---

## CLI (batch / scripted use)

```bash
# process all PDFs in input/
python pipeline.py

# process specific files
python pipeline.py input/report_a.pdf input/report_b.pdf

# use a specific document type
python pipeline.py --type competitor_report input/report.pdf
```

---

## Requirements

- Python 3.12, Node.js (for the frontend)
- Google Gemini API key (free tier available)
- See `requirements.txt` / `frontend/package.json` for dependencies

---

## License

MIT
