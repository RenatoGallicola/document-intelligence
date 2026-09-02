import json


def build_prompt(schema_class, domain_instructions: str = "") -> str:
    """
    Build an extraction prompt for any schema.
    The base prompt is generic; domain-specific rules are passed via domain_instructions.
    """
    schema = schema_class.model_json_schema()
    schema_str = json.dumps(schema, indent=2)

    return f"""
You are an intelligent document analysis assistant.
Extract information from the document and return a JSON object that strictly follows the schema below.
Use EXACTLY the field names defined in the schema. No variations, no synonyms.
If a field is not present or cannot be reliably inferred, return null for that field.
Do not invent or estimate values. Only extract what is explicitly stated or clearly implied.

General rules:
- confidence:
    "high" if data is explicitly labeled and unambiguous
    "medium" if data requires interpretation or calculation
    "low" if data is inferred or uncertain
- extraction_notes: flag ambiguities, unusual structures, or important caveats

{domain_instructions}

JSON Schema to follow exactly:
{schema_str}

Return only valid JSON, no prose, no markdown backticks.
"""