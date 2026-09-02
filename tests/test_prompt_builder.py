"""
Tests for the generic prompt builder.

`build_prompt` is what makes the extraction pipeline document-type agnostic: it
turns any Pydantic schema into JSON Schema and pastes it into a fixed base
prompt. If field names stopped reaching the model, every schema would silently
degrade at once.
"""
from typing import Optional

from pydantic import BaseModel, Field

from core.prompt_builder import build_prompt


class SampleSchema(BaseModel):
    vendor_name: Optional[str] = Field(None, description="Who issued the document")
    total_amount: Optional[float] = Field(None, description="Grand total")
    confidence: Optional[str] = Field(None, description="high, medium or low")


def test_field_names_reach_the_model_verbatim() -> None:
    prompt = build_prompt(SampleSchema)
    assert "vendor_name" in prompt
    assert "total_amount" in prompt


def test_field_descriptions_are_included() -> None:
    prompt = build_prompt(SampleSchema)
    assert "Who issued the document" in prompt


def test_domain_instructions_are_embedded() -> None:
    prompt = build_prompt(SampleSchema, "Treat every figure as thousands of EUR.")
    assert "Treat every figure as thousands of EUR." in prompt


def test_domain_instructions_are_optional() -> None:
    assert build_prompt(SampleSchema)


def test_the_base_prompt_always_asks_for_confidence_and_notes() -> None:
    # Schema Manager appends these two fields to every generated schema
    # precisely because the base prompt always requests them.
    prompt = build_prompt(SampleSchema)
    assert "confidence" in prompt
    assert "extraction_notes" in prompt


def test_the_model_is_told_not_to_invent_values() -> None:
    prompt = build_prompt(SampleSchema)
    assert "null" in prompt
    assert "Do not invent" in prompt


def test_the_model_is_told_to_return_bare_json() -> None:
    prompt = build_prompt(SampleSchema)
    assert "no markdown backticks" in prompt


def test_the_embedded_schema_is_valid_json() -> None:
    import json

    prompt = build_prompt(SampleSchema)
    start = prompt.index("{", prompt.index("JSON Schema to follow exactly:"))
    end = prompt.rindex("}") + 1
    assert json.loads(prompt[start:end])["properties"].keys() >= {"vendor_name", "total_amount"}
