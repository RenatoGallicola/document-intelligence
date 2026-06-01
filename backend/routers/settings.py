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


class SettingsResponse(BaseModel):
    api_key_set: bool
    api_key_preview: str
    model: str


@router.get("", response_model=SettingsResponse)
def get_settings():
    key = os.getenv("GEMINI_API_KEY", "")
    preview = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "not set"
    return {
        "api_key_set": bool(key),
        "api_key_preview": preview,
        "model": "gemini-3.5-flash"
    }


@router.post("/api-key")
def update_api_key(body: APIKeyUpdate):
    set_key(str(ENV_PATH), "GEMINI_API_KEY", body.api_key)
    return {"success": True}