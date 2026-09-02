"""
End-to-end tests over the whole extraction path, with the model call stubbed.

Everything between "a PDF on disk" and "a validated JSON file in output/" runs
for real here: the prompt is built from the schema, the recorded response is
stripped of its markdown fence, parsed, repaired if truncated, validated by
Pydantic and written to disk. Only `generate_content` is replaced, using a
response recorded from the genuine sample extraction; see fixtures/README.md.
"""
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

import extractor
import pipeline

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE_PDF = Path(__file__).parent.parent / "examples" / "invoice" / "sample_invoice.pdf"
EXPECTED = Path(__file__).parent.parent / "examples" / "invoice" / "sample_invoice_output.json"


class FakeModels:
    """Stands in for client.models, recording what the extractor sent."""

    def __init__(self, response_text: str | None) -> None:
        self.response_text = response_text
        self.calls: list[dict] = []

    def generate_content(self, *, model: str, contents: list, config: dict):
        self.calls.append({"model": model, "contents": contents, "config": config})
        return SimpleNamespace(text=self.response_text)


@pytest.fixture
def stub_gemini(monkeypatch: pytest.MonkeyPatch):
    """Replace the Gemini client with one returning a recorded response."""

    def install(fixture_name: str | None, text: str | None = None) -> FakeModels:
        if fixture_name is not None:
            text = (FIXTURES / fixture_name).read_text(encoding="utf-8")
        models = FakeModels(text)
        monkeypatch.setattr(extractor, "_get_client", lambda: SimpleNamespace(models=models))
        return models

    return install


class TestExtractFromDocument:
    def test_a_recorded_response_produces_the_committed_output(self, stub_gemini) -> None:
        stub_gemini("gemini_invoice_response.txt")

        validated = extractor.extract_from_document(str(SAMPLE_PDF), "invoice")
        expected = json.loads(EXPECTED.read_text(encoding="utf-8"))
        expected.pop("document_type", None)

        assert validated.model_dump() == expected

    def test_the_pdf_bytes_and_the_schema_prompt_both_reach_the_model(self, stub_gemini) -> None:
        models = stub_gemini("gemini_invoice_response.txt")

        extractor.extract_from_document(str(SAMPLE_PDF), "invoice")

        assert len(models.calls) == 1
        contents = models.calls[0]["contents"]
        pdf_part, prompt = contents[0], contents[1]

        assert pdf_part.inline_data.mime_type == "application/pdf"
        assert pdf_part.inline_data.data == SAMPLE_PDF.read_bytes()
        assert "vendor_name" in prompt and "line_items" in prompt

    def test_extraction_is_deterministic_by_configuration(self, stub_gemini) -> None:
        models = stub_gemini("gemini_invoice_response.txt")
        extractor.extract_from_document(str(SAMPLE_PDF), "invoice")

        assert models.calls[0]["config"]["temperature"] == 0

    def test_a_truncated_response_is_still_extracted(self, stub_gemini) -> None:
        stub_gemini("gemini_invoice_truncated.txt")

        validated = extractor.extract_from_document(str(SAMPLE_PDF), "invoice")

        # The header fields survived the cut, and so did the line items that
        # were complete before it.
        assert validated.vendor_name == "Northwind Office Supplies"
        assert validated.total_amount.value == 2586.6
        assert validated.total_amount.evidence == "Total Due (USD): $2586.60"
        assert len(validated.line_items) >= 2

    def test_an_unknown_document_type_is_rejected_before_any_call(self, stub_gemini) -> None:
        models = stub_gemini("gemini_invoice_response.txt")

        with pytest.raises(ValueError, match="Unknown document type"):
            extractor.extract_from_document(str(SAMPLE_PDF), "not_a_type")

        assert models.calls == []

    def test_an_unparseable_response_raises_with_the_raw_text(self, stub_gemini) -> None:
        stub_gemini(None, text="I am unable to read this document.")

        with pytest.raises(ValueError, match="Failed to parse Gemini response"):
            extractor.extract_from_document(str(SAMPLE_PDF), "invoice")


class TestProcessDocument:
    def test_writes_a_json_file_and_reports_no_errors(self, stub_gemini, tmp_path: Path) -> None:
        stub_gemini("gemini_invoice_response.txt")

        result = pipeline.process_document(str(SAMPLE_PDF), "invoice", output_dir=str(tmp_path))

        assert result["errors"] is None
        written = Path(result["output_path"])
        assert written.exists()
        assert written.parent == tmp_path

    def test_the_written_file_carries_the_document_type(self, stub_gemini, tmp_path: Path) -> None:
        stub_gemini("gemini_invoice_response.txt")

        result = pipeline.process_document(str(SAMPLE_PDF), "invoice", output_dir=str(tmp_path))
        saved = json.loads(Path(result["output_path"]).read_text(encoding="utf-8"))

        # The model never returns this; the pipeline adds it so Output Explorer
        # can group past extractions by type.
        assert saved["document_type"] == "invoice"
        assert saved["vendor_name"] == "Northwind Office Supplies"

    def test_the_output_file_is_named_after_the_source_pdf(self, stub_gemini, tmp_path: Path) -> None:
        stub_gemini("gemini_invoice_response.txt")

        result = pipeline.process_document(str(SAMPLE_PDF), "invoice", output_dir=str(tmp_path))

        assert Path(result["output_path"]).name.startswith("sample_invoice_")

    def test_the_summary_splits_extracted_from_missing(self, stub_gemini, tmp_path: Path) -> None:
        stub_gemini("gemini_invoice_response.txt")

        summary = pipeline.process_document(
            str(SAMPLE_PDF), "invoice", output_dir=str(tmp_path)
        )["summary"]

        assert "vendor_name" in summary["extracted_fields"]
        assert "extraction_notes" in summary["missing_fields"]
        assert summary["confidence"] == "high"

    def test_a_failing_extraction_is_reported_not_raised(self, stub_gemini, tmp_path: Path) -> None:
        stub_gemini(None, text="not JSON at all")

        result = pipeline.process_document(str(SAMPLE_PDF), "invoice", output_dir=str(tmp_path))

        assert result["validated"] is None
        assert result["output_path"] is None
        assert result["errors"]
        assert list(tmp_path.iterdir()) == []
