"""Data validation service for uploaded marketing datasets.

Runs comprehensive checks and returns structured ValidationReport.
"""

import pandas as pd
import numpy as np


class DataValidator:
    """Validates marketing data before MMM model fitting."""

    def validate(self, df: pd.DataFrame, mapping: dict) -> dict:
        errors = []
        warnings = []
        suggestions = []

        date_col = mapping.get("date_column")
        target_col = mapping.get("target_column")
        media_cols = list(mapping.get("media_columns", {}).keys())
        control_cols = mapping.get("control_columns", [])

        # --- ERRORS (blocking) ---

        if len(df) < 52:
            errors.append({
                "code": "min_rows",
                "message": f"Need at least 52 weeks (1 year) of data. You have {len(df)} rows.",
                "severity": "error",
            })

        if not media_cols:
            errors.append({
                "code": "no_media_cols",
                "message": "No media spend columns mapped.",
                "severity": "error",
            })

        if target_col and df[target_col].sum() == 0:
            errors.append({
                "code": "target_all_zero",
                "message": f"Target column '{target_col}' is all zeros.",
                "column": target_col,
                "severity": "error",
            })

        for col in media_cols:
            if col in df.columns and (df[col] < 0).any():
                errors.append({
                    "code": "negative_spend",
                    "message": f"Negative values in {col} — spend cannot be negative.",
                    "column": col,
                    "severity": "error",
                })

        # Check date gaps
        if date_col and date_col in df.columns:
            dates = pd.to_datetime(df[date_col], errors="coerce")
            if dates.isna().any():
                errors.append({
                    "code": "invalid_dates",
                    "message": f"Some values in '{date_col}' are not valid dates.",
                    "column": date_col,
                    "severity": "error",
                })

        # --- WARNINGS (non-blocking) ---

        if 52 <= len(df) < 104:
            warnings.append({
                "code": "low_rows",
                "message": f"Only {len(df)} weeks of data. 104+ weeks (2 years) recommended for robust results.",
                "severity": "warning",
            })

        for col in media_cols + [target_col] + control_cols:
            if col and col in df.columns:
                null_pct = df[col].isna().mean() * 100
                if null_pct > 5:
                    warnings.append({
                        "code": "high_nulls",
                        "message": f"Column '{col}' has {null_pct:.0f}% missing values. Consider imputation.",
                        "column": col,
                        "severity": "warning",
                    })

                if df[col].std() == 0:
                    warnings.append({
                        "code": "zero_variance",
                        "message": f"Column '{col}' has no variation — it won't add predictive value.",
                        "column": col,
                        "severity": "warning",
                    })

        # Check high correlations between media columns
        if len(media_cols) >= 2:
            numeric_media = df[media_cols].select_dtypes(include=[np.number])
            if len(numeric_media.columns) >= 2:
                corr_matrix = numeric_media.corr()
                for i in range(len(corr_matrix.columns)):
                    for j in range(i + 1, len(corr_matrix.columns)):
                        r = abs(corr_matrix.iloc[i, j])
                        if r > 0.7:
                            col1 = corr_matrix.columns[i]
                            col2 = corr_matrix.columns[j]
                            warnings.append({
                                "code": "high_correlation",
                                "message": f"{col1} and {col2} are {r:.0%} correlated — may cause multicollinearity.",
                                "severity": "warning",
                            })

        # Check outliers
        if target_col and target_col in df.columns:
            values = pd.to_numeric(df[target_col], errors="coerce").dropna()
            if len(values) > 0:
                mean, std = values.mean(), values.std()
                if std > 0:
                    outlier_count = ((values - mean).abs() > 3 * std).sum()
                    if outlier_count > 0:
                        warnings.append({
                            "code": "outliers",
                            "message": f"{outlier_count} outlier weeks detected in '{target_col}' (>3σ from mean).",
                            "column": target_col,
                            "severity": "warning",
                        })

        # --- SUGGESTIONS ---

        has_seasonal = any("holiday" in c.lower() or "season" in c.lower() for c in control_cols)
        if not has_seasonal:
            suggestions.append({
                "code": "add_seasonality",
                "message": "No holiday/seasonal control variable detected. Consider adding one.",
                "severity": "suggestion",
            })

        if target_col and target_col in df.columns:
            skew = pd.to_numeric(df[target_col], errors="coerce").skew()
            if abs(skew) > 2:
                suggestions.append({
                    "code": "log_transform",
                    "message": f"Target '{target_col}' is highly skewed (skew={skew:.1f}). Log transform may improve fit.",
                    "column": target_col,
                    "severity": "suggestion",
                })

        # Build data summary
        data_summary = self._build_summary(df, mapping, media_cols, control_cols)

        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "suggestions": suggestions,
            "data_summary": data_summary,
        }

    def _build_summary(
        self, df: pd.DataFrame, mapping: dict, media_cols: list, control_cols: list
    ) -> dict:
        date_col = mapping.get("date_column", "")
        target_col = mapping.get("target_column", "")

        dates = pd.to_datetime(df.get(date_col, pd.Series()), errors="coerce").dropna()
        target_vals = pd.to_numeric(df.get(target_col, pd.Series()), errors="coerce").dropna()

        total_spend = 0.0
        for col in media_cols:
            if col in df.columns:
                total_spend += pd.to_numeric(df[col], errors="coerce").sum()

        return {
            "row_count": len(df),
            "date_range_start": dates.min().isoformat() if len(dates) > 0 else "",
            "date_range_end": dates.max().isoformat() if len(dates) > 0 else "",
            "frequency": "weekly",
            "media_channel_count": len(media_cols),
            "control_variable_count": len(control_cols),
            "total_media_spend": float(total_spend),
            "avg_target_value": float(target_vals.mean()) if len(target_vals) > 0 else 0.0,
        }
