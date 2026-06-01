from fastapi import APIRouter
import importlib.util
from pathlib import Path

router = APIRouter()
SCHEMAS_DIR = Path("schemas")


def load_schema_info(schema_file: Path) -> dict | None:
    if schema_file.name == "__init__.py":
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
                fields = []
                for field_name, field_info in attr.model_fields.items():
                    fields.append({
                        "name": field_name,
                        "type": str(field_info.annotation),
                        "description": field_info.description or "",
                        "required": field_info.is_required()
                    })
                return {
                    "id": schema_file.stem,
                    "class_name": attr_name,
                    "fields": fields
                }
    except Exception:
        return None


@router.get("")
def list_schemas():
    schemas = []
    for f in SCHEMAS_DIR.glob("*.py"):
        info = load_schema_info(f)
        if info:
            schemas.append(info)
    return schemas


@router.get("/{schema_id}")
def get_schema(schema_id: str):
    schema_file = SCHEMAS_DIR / f"{schema_id}.py"
    if not schema_file.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Schema not found")
    return load_schema_info(schema_file)