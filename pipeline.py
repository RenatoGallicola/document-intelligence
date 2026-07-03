import logging
from pathlib import Path
from extractor import extract_from_document
from validator import summarize_extraction, validate_extraction
from storage import save_to_json

logger = logging.getLogger(__name__)


def process_document(pdf_path: str, document_type: str, output_dir: str = "output") -> dict:
    """
    Full pipeline for a single PDF document.
    Extracts, validates, summarizes and saves the result.

    Args:
        pdf_path: path to the PDF file
        document_type: key in DOCUMENT_TYPES (e.g. "competitor_report")
        output_dir: directory where the JSON output will be saved

    Returns:
        dict with keys: validated, summary, output_path, errors
    """
    logger.info("=" * 60)
    logger.info("Processing: %s", Path(pdf_path).name)
    logger.info("Document type: %s", document_type)
    logger.info("=" * 60)

    # step 1 — extract
    try:
        validated = extract_from_document(pdf_path, document_type)
    except Exception as e:
        logger.info("Extraction failed: %s", e)
        return {
            "validated": None,
            "summary": None,
            "output_path": None,
            "errors": [str(e)],
        }

    # step 2 — validate and summarize
    _, errors = validate_extraction(validated.model_dump(), document_type)
    summary = summarize_extraction(validated)

    logger.info("Extraction summary:")
    logger.info("  Extracted fields : %s", summary['extracted_count'])
    logger.info("  Missing fields   : %s", summary['missing_count'])
    logger.info("  Confidence       : %s", summary['confidence'])
    if summary["missing_fields"]:
        logger.info("  Missing          : %s", ', '.join(summary['missing_fields']))

    # step 3 — save
    result_data = validated.model_dump()
    result_data["document_type"] = document_type

    output_path = save_to_json(result_data, output_dir, source_filename=pdf_path)

    return {
        "validated": validated,
        "summary": summary,
        "output_path": output_path,
        "errors": errors,
    }


def process_batch(pdf_dir: str, document_type: str, output_dir: str = "output") -> list[dict]:
    """
    Process all PDF files in a directory.

    Args:
        pdf_dir: directory containing PDF files
        document_type: key in DOCUMENT_TYPES applied to all files
        output_dir: directory where JSON outputs will be saved

    Returns:
        list of result dicts, one per PDF
    """
    pdf_files = list(Path(pdf_dir).glob("*.pdf"))

    if not pdf_files:
        logger.info("No PDF files found in: %s", pdf_dir)
        return []

    logger.info("Found %d PDF files in %s", len(pdf_files), pdf_dir)
    results = []

    for pdf_path in pdf_files:
        result = process_document(str(pdf_path), document_type, output_dir)
        results.append({
            "file": pdf_path.name,
            **result
        })

    # log final summary
    successful = sum(1 for r in results if r["errors"] is None)
    failed = len(results) - successful

    logger.info("=" * 60)
    logger.info("Batch complete: %d succeeded, %d failed", successful, failed)
    logger.info("=" * 60)

    return results


if __name__ == "__main__":
    import argparse

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    parser = argparse.ArgumentParser(description="Competitor report extraction pipeline")
    parser.add_argument(
        "files",
        nargs="*",
        help="Specific PDF files to process. If omitted, processes all PDFs in input/"
    )
    parser.add_argument(
        "--type",
        default="competitor_report",
        help="Document type (default: competitor_report)"
    )
    args = parser.parse_args()

    if args.files:
        # process only the specified files
        for file in args.files:
            process_document(
                pdf_path=file,
                document_type=args.type,
                output_dir="output"
            )
    else:
        # process all PDFs in input/
        process_batch(
            pdf_dir="input",
            document_type=args.type,
            output_dir="output"
        )