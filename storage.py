import json
from pathlib import Path
from datetime import datetime


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

    print(f"Saved to: {output_path}")
    return str(output_path)


def save_to_delta(validated_instance, table_name: str, spark=None):
    """
    Save a validated extraction result to a Delta table in Microsoft Fabric.
    Only used when running inside Fabric — requires an active Spark session.

    Args:
        validated_instance: validated Pydantic model instance
        table_name: name of the Delta table in the default lakehouse
        spark: active Spark session (must be passed explicitly)
    """
    if spark is None:
        raise RuntimeError("A Spark session is required to save to Delta. Pass spark=spark.")

    import pandas as pd

    data = validated_instance.model_dump()

    # flatten regional_signals list to JSON string for Delta compatibility
    data["regional_signals"] = json.dumps(
        [
            signal if isinstance(signal, dict) else signal.model_dump()
            for signal in data.get("regional_signals", [])
        ]
    )

    # add ingestion timestamp
    data["ingested_at"] = datetime.now().isoformat()

    df_pandas = pd.DataFrame([data])
    df_spark = spark.createDataFrame(df_pandas)

    df_spark.write.format("delta").mode("append").saveAsTable(table_name)
    print(f"Saved to Delta table: {table_name}")