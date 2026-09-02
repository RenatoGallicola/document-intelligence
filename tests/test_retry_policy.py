"""
Tests for the retry predicate.

The distinction this encodes is worth protecting: an invalid API key fails
identically on every attempt, so retrying it four times only delays the error by
~30 seconds, while a 5xx or a 429 genuinely may succeed on the next try. An
earlier version caught `ClientError` wholesale and got this exactly backwards.
"""
import pytest
from google.genai.errors import ClientError, ServerError

from extractor import _get_client, _is_retryable


def client_error(code: int) -> ClientError:
    return ClientError(code, {"error": {"code": code, "message": "test"}})


def server_error(code: int) -> ServerError:
    return ServerError(code, {"error": {"code": code, "message": "test"}})


class TestIsRetryable:
    @pytest.mark.parametrize("code", [500, 502, 503, 504])
    def test_server_errors_retry(self, code: int) -> None:
        assert _is_retryable(server_error(code)) is True

    def test_rate_limiting_retries(self) -> None:
        assert _is_retryable(client_error(429)) is True

    @pytest.mark.parametrize("code", [400, 401, 403, 404])
    def test_permanent_client_errors_do_not_retry(self, code: int) -> None:
        assert _is_retryable(client_error(code)) is False

    def test_empty_response_retries(self) -> None:
        # call_gemini raises ValueError when response.text is None, which is a
        # transient function_call response worth another attempt.
        assert _is_retryable(ValueError("Gemini returned no text content")) is True

    def test_unrelated_exceptions_do_not_retry(self) -> None:
        assert _is_retryable(KeyError("document_type")) is False
        assert _is_retryable(TypeError("bad argument")) is False


class TestClientConstruction:
    def test_missing_key_raises_a_useful_message(self) -> None:
        # The autouse no_api_key fixture has cleared the environment.
        with pytest.raises(ValueError, match="GEMINI_API_KEY is not set"):
            _get_client()

    def test_importing_the_module_never_required_a_key(self) -> None:
        # If the client were built at import time, this module could not have
        # been imported at all under the no_api_key fixture.
        import extractor

        assert extractor._client is None
