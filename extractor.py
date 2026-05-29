import os
import json
import time
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path
from schemas.competitor_report import CompetitorReportSchema
from config import DOCUMENT_TYPES

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


def load_pdf(pdf_path: str) -> bytes:
    """Load a PDF file and return its raw bytes."""
    with open(pdf_path, "rb") as f:
        return f.read()


def call_gemini(pdf_bytes: bytes, prompt: str, model_name: str) -> str:
    """
    Send a PDF and a prompt to Gemini and return the raw text response.
    Retries once on failure with a 5 second delay.
    """
    model = genai.GenerativeModel(model_name)
    pdf_part = {"mime_type": "application/pdf", "data": pdf_bytes}

    try:
        response = model.generate_content([pdf_part, prompt])
        return response.text
    except Exception as e:
        print(f"Gemini call failed: {e}. Retrying in 5 seconds...")
        time.sleep(5)
        response = model.generate_content([pdf_part, prompt])
        return response.text


def parse_response(raw_text: str, document_type: str) -> dict:
    """
    Parse the raw JSON string returned by Gemini.
    Strips markdown backticks if present, then parses to dict.
    """
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
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
    model_name = config["model"]

    if prompt is None:
        raise NotImplementedError(f"Prompt not yet defined for document type: {document_type}")

    print(f"Loading PDF: {pdf_path}")
    pdf_bytes = load_pdf(pdf_path)

    print(f"Calling Gemini ({model_name})...")
    raw_response = call_gemini(pdf_bytes, prompt, model_name)

    print("Parsing response...")
    parsed = parse_response(raw_response, document_type)

    print("Validating against schema...")
    validated = validate_extraction(parsed, document_type)

    print("Extraction complete.")
    return validated