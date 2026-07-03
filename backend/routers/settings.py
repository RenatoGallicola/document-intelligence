from fastapi import APIRouter
from pydantic import BaseModel
from pathlib import Path
from dotenv import load_dotenv, set_key
import os

load_dotenv()

router = APIRouter()
ENV_PATH = Path(".env")


class APIKeyUpdate(BaseModel):
    api_key: str


@router.get("")
def get_settings():
    key = os.getenv("GEMINI_API_KEY", "")
    preview = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "API KEY not set"
    return {
        "api_key_set": bool(key),
        "api_key_preview": preview,
        "model": os.getenv("DEFAULT_MODEL", "gemini-3.5-flash")
    }


@router.post("/api-key")
def update_api_key(body: APIKeyUpdate):
    set_key(str(ENV_PATH), "GEMINI_API_KEY", body.api_key)
    return {"success": True}


@router.post("/model")
def update_model(body: dict):
    set_key(str(ENV_PATH), "DEFAULT_MODEL", body["model"])
    os.environ["DEFAULT_MODEL"] = body["model"]
    return {"success": True}


@router.get("/models")
def list_models():
    try:
        from google import genai
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY", ""))
        models = [
            m.name.replace("models/", "")
            for m in client.models.list()
            if "generateContent" in (m.supported_actions or [])
        ]
        return {"models": models}
    except Exception as e:
        return {"models": ["gemini-3.5-flash", "gemini-2.0-flash"], "error": str(e)}