import json
import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)


def save_to_json(data, output_dir: str = "output", source_filename: str = "") -> str:
    """
    Save a validated extraction result to a JSON file locally.

    Args:
        data: validated Pydantic model instance or dict
        output_dir: directory where the JSON file will be saved
        source_filename: original PDF filename used as base for output name

    Returns:
        path to the saved file
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if source_filename:
        base = Path(source_filename).stem.replace(" ", "_").lower()
    else:
        base = "document"

    filename = f"{base}_{timestamp}.json"
    output_path = Path(output_dir) / filename

    # normalize input (Pydantic -> dict if needed)
    if hasattr(data, "model_dump"):
        data = data.model_dump()

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    logger.info("Saved to: %s", output_path)
    return str(output_path)