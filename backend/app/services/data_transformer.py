"""Data transformation service for preparing uploaded data for the MMM engine."""

import pandas as pd
import numpy as np


class DataTransformer:
    """Transforms raw uploaded data into engine-ready format."""

    def auto_detect_columns(self, df: pd.DataFrame) -> dict:
        """Auto-detect column roles based on names and data types."""
        mapping = {
            "date_column": None,
            "target_column": None,
            "media_columns": {},
            "control_columns": [],
        }

        for col in df.columns:
            col_lower = col.lower()

            # Detect date column
            if any(kw in col_lower for kw in ["date", "week", "month", "day", "period"]):
                try:
                    pd.to_datetime(df[col], errors="raise")
                    if mapping["date_column"] is None:
                        mapping["date_column"] = col
                        continue
                except (ValueError, TypeError):
                    pass

            # Detect target/KPI column
            if any(kw in col_lower for kw in ["revenue", "sales", "conversions", "kpi", "target"]):
                if mapping["target_column"] is None:
                    mapping["target_column"] = col
                    continue

            # Detect media spend columns
            if any(kw in col_lower for kw in ["spend", "cost", "budget", "investment"]):
                channel_name = self._extract_channel_name(col)
                mapping["media_columns"][col] = {
                    "channel_name": channel_name,
                    "spend_type": "spend",
                }
                continue

            if any(kw in col_lower for kw in ["impressions", "impr", "clicks", "grp"]):
                channel_name = self._extract_channel_name(col)
                spend_type = "impressions" if "impr" in col_lower else "clicks"
                mapping["media_columns"][col] = {
                    "channel_name": channel_name,
                    "spend_type": spend_type,
                }
                continue

            # Remaining numeric columns as potential controls
            if pd.api.types.is_numeric_dtype(df[col]):
                mapping["control_columns"].append(col)

        return mapping

    def _extract_channel_name(self, col_name: str) -> str:
        """Extract a human-readable channel name from column name."""
        remove_words = [
            "spend", "cost", "budget", "impressions", "impr",
            "clicks", "grp", "investment", "_", ".",
        ]
        name = col_name.lower()
        for word in remove_words:
            name = name.replace(word, " ")
        name = name.strip().title()
        return name if name else col_name

    def prepare_for_engine(
        self, df: pd.DataFrame, mapping: dict
    ) -> pd.DataFrame:
        """Clean and prepare data for the MMM engine."""
        df = df.copy()

        date_col = mapping["date_column"]
        target_col = mapping["target_column"]
        media_cols = list(mapping["media_columns"].keys())
        control_cols = mapping.get("control_columns", [])

        # Convert date column
        df[date_col] = pd.to_datetime(df[date_col])
        df = df.sort_values(date_col).reset_index(drop=True)

        # Ensure numeric types
        all_numeric = media_cols + control_cols + [target_col]
        for col in all_numeric:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        # Fill missing values
        df[all_numeric] = df[all_numeric].ffill().bfill().fillna(0)

        return df
