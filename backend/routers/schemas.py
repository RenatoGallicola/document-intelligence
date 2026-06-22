import importlib.util
import json
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()
SCHEMAS_DIR = Path("schemas")
PROMPTS_DIR = Path("prompts")
REGISTRY_PATH = SCHEMAS_DIR / "_registry.json"


# ---------------------------------------------------------------------------
# Registry helpers
# ---------------------------------------------------------------------------

def load_registry() -> dict:
    if not REGISTRY_PATH.exists():
        return {}
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))


def save_registry(registry: dict) -> None:
    REGISTRY_PATH.write_text(json.dumps(registry, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# Schema introspection
# ---------------------------------------------------------------------------

def load_schema_info(schema_file: Path) -> dict | None:
    if schema_file.name.startswith("_") or schema_file.name == "__init__.py":
        return None
    try:
        spec = importlib.util.spec_from_file_location(schema_file.stem, schema_file)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if (
                isinstance(attr, type)
                and attr_name.endswith("Schema")
                and attr_name != "BaseModel"
            ):
                registry = load_registry()
                fields = []
                for field_name, field_info in attr.model_fields.items():
                    fields.append({
                        "name": field_name,
                        "type": str(field_info.annotation),
                        "description": field_info.description or "",
                        "required": field_info.is_required(),
                    })
                return {
                    "id": schema_file.stem,
                    "class_name": attr_name,
                    "field_count": len(fields),
                    "fields": fields,
                    "is_managed": schema_file.stem in registry,
                }
    except Exception as exc:
        logger.warning("Could not load schema %s: %s", schema_file, exc)
    return None


# ---------------------------------------------------------------------------
# GET endpoints
# ---------------------------------------------------------------------------

@router.get("")
def list_schemas():
    schemas = []
    for f in sorted(SCHEMAS_DIR.glob("*.py")):
        info = load_schema_info(f)
        if info:
            schemas.append(info)
    return schemas


@router.get("/{schema_id}")
def get_schema(schema_id: str):
    schema_file = SCHEMAS_DIR / f"{schema_id}.py"
    if not schema_file.exists():
        raise HTTPException(status_code=404, detail="Schema not found")
    info = load_schema_info(schema_file)
    if not info:
        raise HTTPException(status_code=422, detail="Could not parse schema file")
    registry = load_registry()
    if schema_id in registry:
        info["managed_fields"] = registry[schema_id]["fields"]
        info["display_name"] = registry[schema_id].get("display_name", schema_id)
    return info


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class SubFieldDef(BaseModel):
    name: str
    type: str
    description: str = ""


class FieldDef(BaseModel):
    name: str
    type: str
    description: str = ""
    is_list: bool = True
    fields: list[SubFieldDef] = []


class SchemaCreateRequest(BaseModel):
    name: str
    class_name: str
    display_name: str
    fields: list[FieldDef]


# ---------------------------------------------------------------------------
# Code generation
# ---------------------------------------------------------------------------

def _to_pascal_case(s: str) -> str:
    return "".join(word.capitalize() for word in s.split("_"))


def _field_line(name: str, ftype: str, description: str, is_list: bool = True) -> str:
    if ftype == "str":
        ann, default = "Optional[str]", "Field(None"
    elif ftype == "float":
        ann, default = "Optional[float]", "Field(None"
    elif ftype == "int":
        ann, default = "Optional[int]", "Field(None"
    elif ftype == "bool":
        ann, default = "Optional[bool]", "Field(None"
    elif ftype == "EvidencedValue":
        ann, default = "Optional[EvidencedValue]", "Field(None"
    elif ftype == "EvidencedStr":
        ann, default = "Optional[EvidencedStr]", "Field(None"
    elif ftype == "list[str]":
        ann, default = "list[str]", "Field(default_factory=list"
    elif ftype == "nested":
        cls = _to_pascal_case(name)
        if is_list:
            ann, default = f"list[{cls}]", "Field(default_factory=list"
        else:
            ann, default = f"Optional[{cls}]", "Field(None"
    else:
        ann, default = "Optional[str]", "Field(None"

    if description:
        escaped = description.replace('"', '\\"')
        return f'{name}: {ann} = {default}, description="{escaped}")'
    return f"{name}: {ann} = {default})"


def _evidenced_types_used(fields: list[FieldDef]) -> set[str]:
    used: set[str] = set()
    for f in fields:
        if f.type in ("EvidencedValue", "EvidencedStr"):
            used.add(f.type)
        if f.type == "nested":
            for nf in f.fields:
                if nf.type in ("EvidencedValue", "EvidencedStr"):
                    used.add(nf.type)
    return used


def _generate_schema_code(req: SchemaCreateRequest) -> str:
    lines = ["from pydantic import BaseModel, Field", "from typing import Optional", ""]

    ev_types = _evidenced_types_used(req.fields)
    if "EvidencedValue" in ev_types:
        lines += [
            "",
            "class EvidencedValue(BaseModel):",
            '    value: Optional[float] = Field(None, description="Extracted numeric value")',
            '    evidence: Optional[str] = Field(None, description="Exact quote and location from the document")',
        ]
    if "EvidencedStr" in ev_types:
        lines += [
            "",
            "class EvidencedStr(BaseModel):",
            '    value: Optional[str] = Field(None, description="Extracted text value")',
            '    evidence: Optional[str] = Field(None, description="Exact quote and location from the document")',
        ]

    for field in req.fields:
        if field.type == "nested":
            nested_cls = _to_pascal_case(field.name)
            lines += ["", f"class {nested_cls}(BaseModel):"]
            if not field.fields:
                lines.append("    pass")
            for nf in field.fields:
                lines.append(f"    {_field_line(nf.name, nf.type, nf.description)}")

    lines += ["", f"class {req.class_name}(BaseModel):"]
    if not req.fields:
        lines.append("    pass")
    for field in req.fields:
        lines.append(f"    {_field_line(field.name, field.type, field.description, field.is_list)}")

    return "\n".join(lines) + "\n"


def _generate_prompt_code(req: SchemaCreateRequest) -> str:
    var = f"{req.name.upper()}_INSTRUCTIONS"
    return (
        f'{var} = """\n'
        f"Extract all relevant information from this {req.display_name}.\n"
        f"Focus on factual, quantitative data where available.\n"
        f'"""\n'
    )


def _update_config(req: SchemaCreateRequest) -> None:
    config_path = Path("config.py")
    content = config_path.read_text(encoding="utf-8")

    name = req.name
    class_name = req.class_name
    instructions_var = f"{name.upper()}_INSTRUCTIONS"
    schema_import = f"from schemas.{name} import {class_name}"
    prompt_import = f"from prompts.{name} import {instructions_var}"

    if schema_import not in content:
        # Insert right after the last import/from line (before the blank lines before DOCUMENT_TYPES)
        lines = content.split("\n")
        doc_types_line = next(
            (i for i, l in enumerate(lines) if l.startswith("DOCUMENT_TYPES")), len(lines)
        )
        last_import = -1
        for i in range(doc_types_line - 1, -1, -1):
            if lines[i].startswith("from ") or lines[i].startswith("import "):
                last_import = i
                break
        if last_import != -1:
            lines.insert(last_import + 1, prompt_import)
            lines.insert(last_import + 1, schema_import)
        else:
            lines.insert(0, prompt_import)
            lines.insert(0, schema_import)
        content = "\n".join(lines)

    if f'    "{name}":' not in content:
        new_entry = (
            f'    "{name}": {{\n'
            f'        "schema": {class_name},\n'
            f'        "prompt": build_prompt({class_name}, {instructions_var}),\n'
            f'        "model": "gemini-3.5-flash",\n'
            f'        "storage_table": "{name}",\n'
            f'    }},\n'
        )
        # find the closing } of DOCUMENT_TYPES by tracking brace depth
        start = content.index("DOCUMENT_TYPES = {")
        depth = 0
        close_idx = -1
        for i in range(start, len(content)):
            if content[i] == "{":
                depth += 1
            elif content[i] == "}":
                depth -= 1
                if depth == 0:
                    close_idx = i
                    break
        if close_idx != -1:
            content = content[:close_idx] + new_entry + content[close_idx:]

    config_path.write_text(content, encoding="utf-8")


# ---------------------------------------------------------------------------
# POST / PUT endpoints
# ---------------------------------------------------------------------------

@router.post("")
def create_schema(req: SchemaCreateRequest):
    schema_path = SCHEMAS_DIR / f"{req.name}.py"
    if schema_path.exists():
        raise HTTPException(status_code=409, detail=f"Schema '{req.name}' already exists")

    prompt_path = PROMPTS_DIR / f"{req.name}.py"

    schema_path.write_text(_generate_schema_code(req), encoding="utf-8")
    if not prompt_path.exists():
        prompt_path.write_text(_generate_prompt_code(req), encoding="utf-8")
    _update_config(req)

    registry = load_registry()
    registry[req.name] = {
        "display_name": req.display_name,
        "class_name": req.class_name,
        "fields": [f.model_dump() for f in req.fields],
    }
    save_registry(registry)

    return {"id": req.name, "class_name": req.class_name}


@router.put("/{schema_id}")
def update_schema(schema_id: str, req: SchemaCreateRequest):
    schema_path = SCHEMAS_DIR / f"{schema_id}.py"
    if not schema_path.exists():
        raise HTTPException(status_code=404, detail="Schema not found")

    registry = load_registry()
    if schema_id not in registry:
        raise HTTPException(
            status_code=403,
            detail="Only schemas created via the Schema Manager can be edited here",
        )

    schema_path.write_text(_generate_schema_code(req), encoding="utf-8")

    registry[schema_id] = {
        "display_name": req.display_name,
        "class_name": req.class_name,
        "fields": [f.model_dump() for f in req.fields],
    }
    save_registry(registry)

    return {"id": schema_id, "class_name": req.class_name}


def _remove_from_config(name: str, class_name: str) -> None:
    config_path = Path("config.py")
    content = config_path.read_text(encoding="utf-8")

    instructions_var = f"{name.upper()}_INSTRUCTIONS"

    # Remove import lines
    lines = content.split("\n")
    schema_import = f"from schemas.{name} import {class_name}"
    prompt_import = f"from prompts.{name} import {instructions_var}"
    lines = [l for l in lines if l.strip() not in (schema_import, prompt_import)]
    content = "\n".join(lines)


    # Remove the dict entry block (tracks brace depth)
    entry_key = f'    "{name}":'
    entry_start = content.find(entry_key)
    if entry_start != -1:
        depth = 0
        i = entry_start
        entry_end = -1
        while i < len(content):
            if content[i] == "{":
                depth += 1
            elif content[i] == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    if end < len(content) and content[end] == ",":
                        end += 1
                    if end < len(content) and content[end] == "\n":
                        end += 1
                    entry_end = end
                    break
            i += 1
        if entry_end != -1:
            content = content[:entry_start] + content[entry_end:]

    config_path.write_text(content, encoding="utf-8")


@router.delete("/{schema_id}")
def delete_schema(schema_id: str):
    registry = load_registry()
    if schema_id not in registry:
        raise HTTPException(
            status_code=403,
            detail="Only schemas created via the Schema Manager can be deleted here",
        )

    class_name = registry[schema_id]["class_name"]

    schema_path = SCHEMAS_DIR / f"{schema_id}.py"
    prompt_path = PROMPTS_DIR / f"{schema_id}.py"

    if schema_path.exists():
        schema_path.unlink()
    if prompt_path.exists():
        prompt_path.unlink()

    _remove_from_config(schema_id, class_name)

    del registry[schema_id]
    save_registry(registry)

    return {"deleted": schema_id}
