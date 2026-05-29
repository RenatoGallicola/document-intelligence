import json
from pathlib import Path
from datetime import datetime


def save_to_json(validated_instance, output_dir: str = "output") -> str:
    """
    Save a validated extraction result to a JSON file locally.
    Used during local development before Fabric integration.

    Args:
        validated_instance: validated Pydantic model instance
        output_dir: directory where the JSON file will be saved

    Returns:
        path to the saved file
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    competitor = validated_instance.competitor_name or "unknown"
    period = validated_instance.report_period or "unknown"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # build filename from competitor name, period and timestamp
    safe_competitor = competitor.replace(" ", "_").lower()
    safe_period = period.replace(" ", "_").lower()
    filename = f"{safe_competitor}_{safe_period}_{timestamp}.json"

    output_path = Path(output_dir) / filename

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(validated_instance.model_dump(), f, indent=2, ensure_ascii=False)

    print(f"Saved to: {output_path}")
    return str(output_path)


def save_to_delta(validated_instance, table_name: str, spark=None):
    """
    Save a validated extraction result to a Delta table in Microsoft Fabric.
    Only used when running inside Fabric — requires an active Spark session.

    Args:
        validated_instance: validated Pydantic model instance
        table_name: name of the Delta table in the default lakehouse
        spark: active Spark session (passed explicitly to avoid global state)
    """
    if spark is None:
        raise RuntimeError("A Spark session is required to save to Delta. Pass spark=spark.")

    import pandas as pd

    data = validated_instance.model_dump()

    # flatten regional_signals list to JSON string for Delta compatibility
    data["regional_signals"] = json.dumps(
        [signal if isinstance(signal, dict) else signal.model_dump()
         for signal in data.get("regional_signals", [])]
    )

    # add ingestion timestamp
    data["ingested_at"] = datetime.now().isoformat()

    df_pandas = pd.DataFrame([data])
    df_spark = spark.createDataFrame(df_pandas)

    df_spark.write.format("delta").mode("append").saveAsTable(table_name)
    print(f"Saved to Delta table: {table_name}")