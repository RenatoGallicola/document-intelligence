from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pathlib import Path
import json
import shutil
from fastapi import HTTPException
from pathlib import Path

router = APIRouter()
INPUT_DIR = Path("input")
OUTPUT_DIR = Path("output")


@router.post("/process")
async def process_document(
    file: UploadFile = File(...),
    document_type: str = Form(...)
):
    INPUT_DIR.mkdir(exist_ok=True)
    OUTPUT_DIR.mkdir(exist_ok=True)

    pdf_path = INPUT_DIR / file.filename
    with open(pdf_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        from pipeline import process_document as run_pipeline
        result = run_pipeline(
            pdf_path=str(pdf_path),
            document_type=document_type,
            output_dir=str(OUTPUT_DIR)
        )

        if result["errors"]:
            raise HTTPException(status_code=422, detail=str(result["errors"]))

        return {
            "success": True,
            "filename": file.filename,
            "summary": result["summary"],
            "data": result["validated"].model_dump(),
            "output_path": result["output_path"]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/outputs")
def list_outputs():
    OUTPUT_DIR.mkdir(exist_ok=True)
    outputs = []
    for f in sorted(
        OUTPUT_DIR.glob("*.json"),
        key=lambda f: f.stat().st_mtime,
        reverse=True
    ):
        try:
            with open(f, "r", encoding="utf-8") as fp:
                data = json.load(fp)
            outputs.append({
                "filename": f.name,
                "path": str(f),
                "data": data
            })
        except Exception:
            continue
    return outputs

@router.delete("/outputs/{filename}")
def delete_output(filename: str):
    file_path = OUTPUT_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        file_path.unlink()
        return {"success": True, "deleted": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))