from schemas.competitor_report import CompetitorReportSchema
from prompts.competitor_report import COMPETITOR_REPORT_INSTRUCTIONS
from core.prompt_builder import build_prompt


DOCUMENT_TYPES = {
    "competitor_report": {
        "schema": CompetitorReportSchema,
        "prompt": build_prompt(CompetitorReportSchema, COMPETITOR_REPORT_INSTRUCTIONS),
        "storage_table": "competitor_signals",
    },
}