"""
Tests for response parsing and truncation repair.

These cover the path a real Gemini response takes between the API call and
Pydantic: markdown fences stripped, then parsed, then, when the model ran out
of output tokens mid-object, repaired rather than discarded.
"""
import json

import pytest

from extractor import _repair_truncated_json, parse_response


class TestRepairTruncatedJson:
    def test_closes_a_string_cut_mid_word(self) -> None:
        assert _repair_truncated_json('{"vendor": "Northwind Offi') == {"vendor": "Northwind Offi"}

    def test_closes_nested_objects_and_arrays(self) -> None:
        truncated = '{"items": [{"name": "Chair", "price": {"value": 210.0'
        assert _repair_truncated_json(truncated) == {
            "items": [{"name": "Chair", "price": {"value": 210.0}}]
        }

    def test_drops_a_dangling_comma(self) -> None:
        assert _repair_truncated_json('{"a": 1, "b": 2},') == {"a": 1, "b": 2}

    def test_an_odd_escaped_quote_does_not_end_the_string(self) -> None:
        # The scanner must skip \" explicitly. With an *odd* number of escaped
        # quotes it would otherwise finish believing it is outside the string,
        # skip the closing quote and produce unparseable output. (An even
        # number happens to flip the flag back and hides the bug, which is why
        # this case is written with one.)
        repaired = _repair_truncated_json('{"note": "he said \\"yes and then')
        assert repaired == {"note": 'he said "yes and then'}

    def test_a_brace_inside_a_string_is_not_counted_as_structure(self) -> None:
        # Same failure mode seen from the other side: after a mishandled escape
        # the scanner treats a literal } in the text as a closing brace and
        # unbalances the stack.
        repaired = _repair_truncated_json('{"note": "closing \\" } brace')
        assert repaired == {"note": 'closing " } brace'}

    def test_complete_json_is_returned_unchanged(self) -> None:
        payload = {"a": [1, 2, 3], "b": {"c": None}}
        assert _repair_truncated_json(json.dumps(payload)) == payload

    def test_unrepairable_input_raises(self) -> None:
        with pytest.raises(Exception):
            _repair_truncated_json("this was never JSON")


class TestParseResponse:
    def test_plain_json(self) -> None:
        assert parse_response('{"a": 1}', "invoice") == {"a": 1}

    def test_strips_a_json_fenced_block(self) -> None:
        raw = '```json\n{"a": 1}\n```'
        assert parse_response(raw, "invoice") == {"a": 1}

    def test_strips_a_bare_fenced_block(self) -> None:
        raw = '```\n{"a": 1}\n```'
        assert parse_response(raw, "invoice") == {"a": 1}

    def test_surrounding_whitespace_is_ignored(self) -> None:
        assert parse_response('\n\n  {"a": 1}  \n', "invoice") == {"a": 1}

    def test_falls_back_to_repair_when_truncated(self) -> None:
        assert parse_response('{"a": 1, "b": "cut off here', "invoice") == {
            "a": 1,
            "b": "cut off here",
        }

    def test_repairs_inside_a_fenced_block(self) -> None:
        assert parse_response('```json\n{"a": 1, "b": "cut', "invoice") == {"a": 1, "b": "cut"}

    def test_unparseable_response_raises_value_error_with_the_raw_text(self) -> None:
        with pytest.raises(ValueError, match="Failed to parse Gemini response"):
            parse_response("I could not read this document.", "invoice")
