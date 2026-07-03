from schemas.competitor_report import CompetitorReportSchema
from prompts.competitor_report import COMPETITOR_REPORT_INSTRUCTIONS
from core.prompt_builder import build_prompt
from schemas.invoice import InvoiceSchema
from prompts.invoice import INVOICE_INSTRUCTIONS


DOCUMENT_TYPES = {
    "competitor_report": {
        "schema": CompetitorReportSchema,
        "prompt": build_prompt(CompetitorReportSchema, COMPETITOR_REPORT_INSTRUCTIONS),
        "storage_table": "competitor_signals",
    },
    "invoice": {
        "schema": InvoiceSchema,
        "prompt": build_prompt(InvoiceSchema, INVOICE_INSTRUCTIONS),
        "storage_table": "invoice",
    },
}