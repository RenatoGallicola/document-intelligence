from schemas.competitor_report import CompetitorReportSchema
from prompts.competitor_report import COMPETITOR_REPORT_INSTRUCTIONS
from core.prompt_builder import build_prompt


DOCUMENT_TYPES = {
    "competitor_report": {
        "schema": CompetitorReportSchema,
        "prompt": build_prompt(CompetitorReportSchema, COMPETITOR_REPORT_INSTRUCTIONS),
        "model": "gemini-3-flash-preview",
        "storage_table": "competitor_signals",
    },
    # "competitor_report": {
    #     "schema": CompetitorReportSchema,
    #     "prompt": build_prompt(CompetitorReportSchema, COMPETITOR_REPORT_INSTRUCTIONS),
    #     "model": "gemini-3-flash-preview",
    #     "storage_table": "competitor_signals",
    # },
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