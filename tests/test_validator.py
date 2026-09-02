"""
Tests for schema validation and the extraction summary shown in the Processor.
"""
from validator import format_validation_errors, summarize_extraction, validate_extraction

VALID_INVOICE = {
    "vendor_name": "Northwind Office Supplies",
    "invoice_number": "NW-2024-00817",
    "currency": "USD",
    "total_amount": {"value": 2586.6, "evidence": "Total Due (USD): $2586.60"},
    "confidence": "high",
}


class TestValidateExtraction:
    def test_valid_payload_returns_an_instance_and_no_errors(self) -> None:
        validated, errors = validate_extraction(dict(VALID_INVOICE), "invoice")
        assert errors is None
        assert validated.vendor_name == "Northwind Office Supplies"
        assert validated.total_amount.value == 2586.6

    def test_a_null_evidenced_value_is_accepted(self) -> None:
        # EvidencedValue fields must be Optional[...] = None rather than use a
        # default_factory, or a legitimate null from the model fails validation.
        payload = dict(VALID_INVOICE, total_amount=None)
        validated, errors = validate_extraction(payload, "invoice")
        assert errors is None
        assert validated.total_amount is None

    def test_a_bare_number_is_coerced_into_an_evidenced_value(self) -> None:
        payload = dict(VALID_INVOICE, total_amount=2586.6)
        validated, errors = validate_extraction(payload, "invoice")
        assert errors is None
        assert validated.total_amount.value == 2586.6
        assert validated.total_amount.evidence is None

    def test_a_wrong_type_is_reported_rather_than_raised(self) -> None:
        payload = dict(VALID_INVOICE, total_amount={"value": "not a number"})
        validated, errors = validate_extraction(payload, "invoice")
        assert validated is None
        assert errors
        assert any("total_amount" in e["field"] for e in errors)

    def test_unknown_fields_from_the_model_are_ignored(self) -> None:
        payload = dict(VALID_INVOICE, hallucinated_field="whatever")
        _, errors = validate_extraction(payload, "invoice")
        assert errors is None


class TestFormatValidationErrors:
    def test_each_error_names_the_field_value_and_reason(self) -> None:
        from pydantic import ValidationError

        from config import DOCUMENT_TYPES

        schema = DOCUMENT_TYPES["invoice"]["schema"]
        try:
            schema(total_amount={"value": "nope"})
        except ValidationError as exc:
            errors = format_validation_errors(exc)
        assert errors
        for entry in errors:
            assert set(entry) == {"field", "value", "message"}
        assert any("total_amount" in e["field"] for e in errors)


class TestSummarizeExtraction:
    def test_counts_split_between_extracted_and_missing(self) -> None:
        validated, _ = validate_extraction(dict(VALID_INVOICE), "invoice")
        summary = summarize_extraction(validated)

        assert "vendor_name" in summary["extracted_fields"]
        assert summary["extracted_count"] == len(summary["extracted_fields"])
        assert summary["missing_count"] == len(summary["missing_fields"])
        assert summary["confidence"] == "high"

    def test_empty_lists_count_as_missing_not_extracted(self) -> None:
        validated, _ = validate_extraction(dict(VALID_INVOICE), "invoice")
        summary = summarize_extraction(validated)

        assert "line_items" in summary["missing_fields"]
        assert "line_items" not in summary["extracted_fields"]

    def test_no_field_is_counted_twice(self) -> None:
        validated, _ = validate_extraction(dict(VALID_INVOICE), "invoice")
        summary = summarize_extraction(validated)

        assert not set(summary["extracted_fields"]) & set(summary["missing_fields"])
