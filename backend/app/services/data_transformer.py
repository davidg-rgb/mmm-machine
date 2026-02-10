"""Data transformation service for preparing uploaded data for the MMM engine."""

import pandas as pd
import numpy as np


# Keywords for auto-detection heuristics
_DATE_KEYWORDS = ["date", "week", "month", "day", "period", "time", "dt"]
_TARGET_KEYWORDS = [
    "revenue", "sales", "conversions", "kpi", "target", "income",
    "orders", "transactions", "gmv", "bookings",
]
_MEDIA_SPEND_KEYWORDS = [
    "spend", "cost", "budget", "investment", "ad_spend", "adspend",
    "media_cost", "paid",
]
_MEDIA_VOLUME_KEYWORDS = [
    "impressions", "impr", "clicks", "grp", "reach", "views",
    "sessions", "visits",
]
_CONTROL_KEYWORDS = [
    "temperature", "temp", "weather", "holiday", "season", "promo",
    "promotion", "competitor", "event", "price", "discount", "index",
]


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

        used_cols = set()

        # Pass 1: Detect date column
        for col in df.columns:
            col_lower = col.lower().strip()
            if any(kw in col_lower for kw in _DATE_KEYWORDS):
                try:
                    parsed = pd.to_datetime(df[col], errors="coerce")
                    if parsed.notna().sum() > len(df) * 0.8:
                        mapping["date_column"] = col
                        used_cols.add(col)
                        break
                except (ValueError, TypeError):
                    pass

        # If no keyword match, try parsing every column as date
        if mapping["date_column"] is None:
            for col in df.columns:
                if col in used_cols:
                    continue
                if df[col].dtype == "object" or hasattr(df[col].dtype, "tz"):
                    try:
                        parsed = pd.to_datetime(df[col], errors="coerce")
                        if parsed.notna().sum() > len(df) * 0.8:
                            mapping["date_column"] = col
                            used_cols.add(col)
                            break
                    except (ValueError, TypeError):
                        pass

        # Pass 2: Detect target column
        for col in df.columns:
            if col in used_cols:
                continue
            col_lower = col.lower().strip()
            if any(kw in col_lower for kw in _TARGET_KEYWORDS):
                if pd.api.types.is_numeric_dtype(df[col]) or self._is_coercible_numeric(df[col]):
                    mapping["target_column"] = col
                    used_cols.add(col)
                    break

        # Pass 3: Detect media spend/volume columns
        for col in df.columns:
            if col in used_cols:
                continue
            col_lower = col.lower().strip()

            is_spend = any(kw in col_lower for kw in _MEDIA_SPEND_KEYWORDS)
            is_volume = any(kw in col_lower for kw in _MEDIA_VOLUME_KEYWORDS)

            if is_spend or is_volume:
                if pd.api.types.is_numeric_dtype(df[col]) or self._is_coercible_numeric(df[col]):
                    channel_name = self._extract_channel_name(col)
                    spend_type = "spend" if is_spend else self._detect_volume_type(col)
                    mapping["media_columns"][col] = {
                        "channel_name": channel_name,
                        "spend_type": spend_type,
                    }
                    used_cols.add(col)

        # Pass 4: Detect control columns
        for col in df.columns:
            if col in used_cols:
                continue
            col_lower = col.lower().strip()

            # Explicit control keyword match
            is_control = any(kw in col_lower for kw in _CONTROL_KEYWORDS)
            if is_control and (pd.api.types.is_numeric_dtype(df[col]) or self._is_coercible_numeric(df[col])):
                mapping["control_columns"].append(col)
                used_cols.add(col)

        return mapping

    def _is_coercible_numeric(self, series: pd.Series) -> bool:
        """Check if a Series can be converted to numeric with >80% success."""
        coerced = pd.to_numeric(series, errors="coerce")
        return coerced.notna().sum() > len(series) * 0.8

    def _extract_channel_name(self, col_name: str) -> str:
        """Extract a human-readable channel name from column name."""
        remove_words = [
            "spend", "cost", "budget", "impressions", "impr",
            "clicks", "grp", "investment", "ad_spend", "adspend",
            "media_cost", "paid", "reach", "views", "sessions", "visits",
        ]
        name = col_name.lower()
        # Replace common separators with spaces
        for sep in ["_", ".", "-"]:
            name = name.replace(sep, " ")
        for word in remove_words:
            name = name.replace(word, " ")
        # Collapse multiple spaces
        name = " ".join(name.split()).strip().title()
        return name if name else col_name

    def _detect_volume_type(self, col_name: str) -> str:
        """Detect volume metric type from column name."""
        col_lower = col_name.lower()
        if "impr" in col_lower:
            return "impressions"
        if "click" in col_lower:
            return "clicks"
        if "grp" in col_lower:
            return "grp"
        if "reach" in col_lower:
            return "reach"
        if "view" in col_lower:
            return "views"
        return "volume"

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

        # Fill missing values: forward fill then backward fill, final zeros
        df[all_numeric] = df[all_numeric].ffill().bfill().fillna(0)

        # Ensure no negative spend (clamp to 0)
        for col in media_cols:
            df[col] = df[col].clip(lower=0)

        # Select only the columns the engine needs
        keep_cols = [date_col, target_col] + media_cols + control_cols
        df = df[keep_cols]

        return df
