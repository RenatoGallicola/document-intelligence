import os
import json
import logging
import time
from google import genai
from google.genai import types
from dotenv import load_dotenv
from pathlib import Path
from schemas.competitor_report import CompetitorReportSchema
from config import DOCUMENT_TYPES
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from google.genai.errors import ClientError

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
logger = logging.getLogger(__name__)


def load_pdf(pdf_path: str) -> bytes:
    """Load a PDF file and return its raw bytes."""
    with open(pdf_path, "rb") as f:
        return f.read()

@retry(
    retry=retry_if_exception_type((ClientError, ValueError)),
    wait=wait_exponential(multiplier=1, min=2, max=60),
    stop=stop_after_attempt(4)
)
def call_gemini(pdf_bytes: bytes, prompt: str, model_name: str) -> str:
    """
    Send a PDF and a prompt to Gemini and return the raw text response.
    Retries up to 4 times with exponential backoff on ClientError (429, 503).
    """
    response = client.models.generate_content(
        model=model_name,
        contents=[
            types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
            prompt
        ],
        config={"temperature": 0, "max_output_tokens": 16000}
    )
    if response.text is None:
        raise ValueError("Gemini returned no text content (likely a transient function_call response — retrying)")
    return response.text


def _repair_truncated_json(text: str) -> dict:
    """
    Close all unclosed strings and brackets in a truncated JSON string.
    Handles the common case where Gemini cuts off mid-string.
    """
    t = text.strip().rstrip(',')
    stack = []
    in_string = False
    i = 0
    while i < len(t):
        c = t[i]
        if c == '\\' and in_string:
            i += 2
            continue
        if c == '"':
            in_string = not in_string
        elif not in_string:
            if c in '{[':
                stack.append('}' if c == '{' else ']')
            elif c in '}]' and stack:
                stack.pop()
        i += 1
    if in_string:
        t += '"'
    t += ''.join(reversed(stack))
    return json.loads(t)


def parse_response(raw_text: str, document_type: str) -> dict:
    """
    Parse the raw JSON string returned by Gemini.
    Strips markdown backticks if present, then parses to dict.
    Falls back to truncation repair if the response was cut off.
    """
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        try:
            return _repair_truncated_json(cleaned)
        except (json.JSONDecodeError, Exception) as e:
            raise ValueError(f"Failed to parse Gemini response as JSON: {e}\nRaw response:\n{raw_text}")


def validate_extraction(data: dict, document_type: str):
    """
    Validate the extracted dict against the Pydantic schema
    for the given document type. Returns a validated schema instance.
    """
    schema_class = DOCUMENT_TYPES[document_type]["schema"]
    if schema_class is None:
        raise NotImplementedError(f"Schema not yet defined for document type: {document_type}")
    return schema_class(**data)


def extract_from_document(pdf_path: str, document_type: str):
    """
    Full extraction pipeline for a single PDF.
    Returns a validated Pydantic model instance.

    Args:
        pdf_path: path to the PDF file
        document_type: key in DOCUMENT_TYPES (e.g. "competitor_report")

    Returns:
        validated Pydantic model instance with extracted fields
    """
    if document_type not in DOCUMENT_TYPES:
        raise ValueError(f"Unknown document type: {document_type}. Must be one of {list(DOCUMENT_TYPES.keys())}")

    config = DOCUMENT_TYPES[document_type]
    prompt = config["prompt"]
    model_name = os.getenv("DEFAULT_MODEL", "gemini-3.5-flash")

    if prompt is None:
        raise NotImplementedError(f"Prompt not yet defined for document type: {document_type}")

    logger.info("Loading PDF: %s", pdf_path)
    pdf_bytes = load_pdf(pdf_path)

    logger.info("Calling Gemini (%s)...", model_name)
    raw_response = call_gemini(pdf_bytes, prompt, model_name)

    logger.info("Parsing response...")
    parsed = parse_response(raw_response, document_type)

    logger.info("Validating against schema...")
    validated = validate_extraction(parsed, document_type)

    logger.info("Extraction complete.")
    return validated