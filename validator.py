from pydantic import ValidationError
from config import DOCUMENT_TYPES


def validate_extraction(data: dict, document_type: str):
    """
    Validate extracted data against the Pydantic schema for the given document type.
    Returns a tuple (validated_instance, errors) where errors is None on success.
    """
    schema_class = DOCUMENT_TYPES[document_type]["schema"]

    if schema_class is None:
        raise NotImplementedError(f"Schema not yet defined for document type: {document_type}")

    try:
        validated = schema_class(**data)
        return validated, None
    except ValidationError as e:
        return None, format_validation_errors(e)


def format_validation_errors(error: ValidationError) -> list[dict]:
    """
    Format Pydantic validation errors into a readable list of dicts.
    Each entry contains the field, the invalid value, and the error message.
    """
    errors = []
    for err in error.errors():
        errors.append({
            "field": " -> ".join(str(loc) for loc in err["loc"]),
            "value": err.get("input"),
            "message": err["msg"],
        })
    return errors


def summarize_extraction(validated_instance) -> dict:
    """
    Return a human-readable summary of the extraction result.
    Shows which fields were successfully extracted and which are null.
    """
    data = validated_instance.model_dump()
    extracted = {k: v for k, v in data.items() if v is not None and v != [] }
    missing = [k for k, v in data.items() if v is None or v == []]

    return {
        "extracted_fields": list(extracted.keys()),
        "missing_fields": missing,
        "extracted_count": len(extracted),
        "missing_count": len(missing),
        "confidence": data.get("confidence"),
    }