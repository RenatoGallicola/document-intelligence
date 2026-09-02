"""
Shared test configuration.

The suite deliberately needs no API key, no network and no Gemini client: the
client is built lazily inside `extractor._get_client()`, so every pure helper in
`extractor.py` is reachable without one. Any key present in the developer's
environment is cleared here so a test can never accidentally make a real call.
"""
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))


@pytest.fixture(autouse=True)
def no_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ensure no test can reach the real API, even on a developer machine."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)


@pytest.fixture
def config_sandbox(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """
    A throwaway working directory holding a `config.py` shaped like the real one.

    `_update_config` and `_remove_from_config` operate on `Path("config.py")`,
    relative to the process working directory, so tests must run inside a
    sandbox rather than against the repository's own config.
    """
    config = tmp_path / "config.py"
    config.write_text(
        "from schemas.invoice import InvoiceSchema\n"
        "from prompts.invoice import INVOICE_INSTRUCTIONS\n"
        "from core.prompt_builder import build_prompt\n"
        "\n"
        "\n"
        "# A comment that must survive every edit.\n"
        "DOCUMENT_TYPES = {\n"
        '    "invoice": {\n'
        '        "schema": InvoiceSchema,\n'
        '        "prompt": build_prompt(InvoiceSchema, INVOICE_INSTRUCTIONS),\n'
        "    },\n"
        "}\n",
        encoding="utf-8",
    )
    monkeypatch.chdir(tmp_path)
    return config
