"""
Tests for Schema Manager's code generation.

This is the riskiest logic in the project: it writes Python source and edits
`config.py` in place. The config edits deliberately splice text by brace depth
rather than re-serialising a parsed file, so that comments and formatting
survive, which also means a bug here corrupts the one registry the whole app
reads.
"""
from pathlib import Path

import pytest

from backend.routers.schemas import (
    FieldDef,
    SchemaCreateRequest,
    SubFieldDef,
    _field_line,
    _generate_schema_code,
    _remove_from_config,
    _to_pascal_case,
    _update_config,
)


def request_for(fields: list[FieldDef], name: str = "market_report") -> SchemaCreateRequest:
    return SchemaCreateRequest(
        name=name,
        class_name=_to_pascal_case(name) + "Schema",
        display_name="Market Report",
        fields=fields,
    )


class TestFieldLine:
    @pytest.mark.parametrize(
        "ftype,expected",
        [
            ("str", "Optional[str]"),
            ("float", "Optional[float]"),
            ("int", "Optional[int]"),
            ("bool", "Optional[bool]"),
            ("EvidencedValue", "Optional[EvidencedValue]"),
            ("EvidencedStr", "Optional[EvidencedStr]"),
        ],
    )
    def test_scalar_types_are_optional_and_default_to_none(self, ftype: str, expected: str) -> None:
        line = _field_line("some_field", ftype, "")
        assert line == f"some_field: {expected} = Field(None)"

    def test_lists_use_a_default_factory_not_none(self) -> None:
        assert _field_line("tags", "list[str]", "") == "tags: list[str] = Field(default_factory=list)"

    def test_an_unknown_type_degrades_to_optional_str(self) -> None:
        assert _field_line("mystery", "not_a_type", "") == "mystery: Optional[str] = Field(None)"

    def test_quotes_in_a_description_are_escaped(self) -> None:
        line = _field_line("note", "str", 'the so-called "adjusted" figure')
        assert '\\"adjusted\\"' in line
        compile(f"x = dict({line.split('=', 1)[1].strip()})", "<test>", "exec")

    def test_nested_is_a_list_or_a_single_object_depending_on_is_list(self) -> None:
        assert _field_line("line_item", "nested", "", is_list=True).startswith(
            "line_item: list[LineItem]"
        )
        assert _field_line("line_item", "nested", "", is_list=False).startswith(
            "line_item: Optional[LineItem]"
        )


class TestGenerateSchemaCode:
    def test_generated_code_is_valid_python(self) -> None:
        req = request_for([FieldDef(name="revenue", type="EvidencedValue", description="Total revenue")])
        compile(_generate_schema_code(req), "<generated>", "exec")

    def test_generated_code_defines_a_working_pydantic_model(self) -> None:
        req = request_for([FieldDef(name="revenue", type="EvidencedValue", description="Total revenue")])
        namespace: dict = {}
        exec(_generate_schema_code(req), namespace)

        model = namespace["MarketReportSchema"]
        instance = model(revenue={"value": 1.5, "evidence": "p. 12"})
        assert instance.revenue.value == 1.5
        assert instance.confidence is None

    def test_evidenced_helper_classes_appear_only_when_used(self) -> None:
        without = _generate_schema_code(request_for([FieldDef(name="title", type="str")]))
        assert "class EvidencedValue" not in without

        with_ev = _generate_schema_code(
            request_for([FieldDef(name="revenue", type="EvidencedValue")])
        )
        assert "class EvidencedValue" in with_ev
        assert "class EvidencedStr" not in with_ev

    def test_an_evidenced_type_used_only_inside_a_nested_field_is_still_defined(self) -> None:
        req = request_for(
            [
                FieldDef(
                    name="segment",
                    type="nested",
                    fields=[SubFieldDef(name="sales", type="EvidencedValue")],
                )
            ]
        )
        code = _generate_schema_code(req)
        assert "class EvidencedValue" in code
        assert "class Segment(BaseModel):" in code
        compile(code, "<generated>", "exec")

    def test_an_empty_nested_object_still_compiles(self) -> None:
        req = request_for([FieldDef(name="empty_block", type="nested", fields=[])])
        code = _generate_schema_code(req)
        assert "    pass" in code
        compile(code, "<generated>", "exec")

    def test_confidence_and_notes_are_appended_to_every_schema(self) -> None:
        code = _generate_schema_code(request_for([FieldDef(name="title", type="str")]))
        assert "confidence: Optional[str]" in code
        assert "extraction_notes: Optional[str]" in code

    def test_a_user_defined_confidence_field_is_not_duplicated(self) -> None:
        code = _generate_schema_code(
            request_for(
                [
                    FieldDef(name="title", type="str"),
                    FieldDef(name="confidence", type="str", description="mine"),
                ]
            )
        )
        assert code.count("confidence:") == 1


class TestConfigSplicing:
    def test_adds_imports_and_an_entry(self, config_sandbox: Path) -> None:
        _update_config(request_for([FieldDef(name="title", type="str")]))
        content = config_sandbox.read_text(encoding="utf-8")

        assert "from schemas.market_report import MarketReportSchema" in content
        assert "from prompts.market_report import MARKET_REPORT_INSTRUCTIONS" in content
        assert '"market_report": {' in content
        assert "build_prompt(MarketReportSchema, MARKET_REPORT_INSTRUCTIONS)" in content

    def test_the_existing_entry_and_comments_survive(self, config_sandbox: Path) -> None:
        _update_config(request_for([FieldDef(name="title", type="str")]))
        content = config_sandbox.read_text(encoding="utf-8")

        assert '"invoice": {' in content
        assert "# A comment that must survive every edit." in content

    def test_the_result_is_still_valid_python(self, config_sandbox: Path) -> None:
        _update_config(request_for([FieldDef(name="title", type="str")]))
        compile(config_sandbox.read_text(encoding="utf-8"), "config.py", "exec")

    def test_applying_the_same_schema_twice_changes_nothing(self, config_sandbox: Path) -> None:
        req = request_for([FieldDef(name="title", type="str")])
        _update_config(req)
        once = config_sandbox.read_text(encoding="utf-8")
        _update_config(req)
        assert config_sandbox.read_text(encoding="utf-8") == once

    def test_two_schemas_can_coexist(self, config_sandbox: Path) -> None:
        _update_config(request_for([FieldDef(name="title", type="str")], name="market_report"))
        _update_config(request_for([FieldDef(name="title", type="str")], name="press_release"))
        content = config_sandbox.read_text(encoding="utf-8")

        assert '"market_report": {' in content
        assert '"press_release": {' in content
        compile(content, "config.py", "exec")

    def test_removal_restores_the_original_file(self, config_sandbox: Path) -> None:
        original = config_sandbox.read_text(encoding="utf-8")
        _update_config(request_for([FieldDef(name="title", type="str")]))
        _remove_from_config("market_report", "MarketReportSchema")

        assert config_sandbox.read_text(encoding="utf-8") == original

    def test_removal_leaves_the_other_entries_alone(self, config_sandbox: Path) -> None:
        _update_config(request_for([FieldDef(name="title", type="str")], name="market_report"))
        _update_config(request_for([FieldDef(name="title", type="str")], name="press_release"))
        _remove_from_config("market_report", "MarketReportSchema")
        content = config_sandbox.read_text(encoding="utf-8")

        assert '"market_report": {' not in content
        assert '"press_release": {' in content
        assert '"invoice": {' in content
        compile(content, "config.py", "exec")


class TestToPascalCase:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("market_report", "MarketReport"),
            ("invoice", "Invoice"),
            ("line_item_detail", "LineItemDetail"),
        ],
    )
    def test_snake_case_becomes_pascal_case(self, raw: str, expected: str) -> None:
        assert _to_pascal_case(raw) == expected
