from schemas.competitor_report import CompetitorReportSchema
from prompts.competitor_report import COMPETITOR_REPORT_INSTRUCTIONS
from core.prompt_builder import build_prompt


DOCUMENT_TYPES = {
    # "competitor_report": {
    #     "schema": CompetitorReportSchema,
    #     "prompt": build_prompt(CompetitorReportSchema, COMPETITOR_REPORT_INSTRUCTIONS),
    #     "model": "gemini-3-flash-preview",
    #     "storage_table": "competitor_signals",
    # },
    "competitor_report": {
        "schema": CompetitorReportSchema,
        "prompt": build_prompt(CompetitorReportSchema, COMPETITOR_REPORT_INSTRUCTIONS),
        "model": "gemini-3.5-flash",
        # "model": "gemini-3-flash-preview",
        "storage_table": "competitor_signals",
    },
}