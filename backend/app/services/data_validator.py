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

        # Check required columns exist in dataframe
        all_mapped = []
        if date_col:
            all_mapped.append(date_col)
        if target_col:
            all_mapped.append(target_col)
        all_mapped.extend(media_cols)
        all_mapped.extend(control_cols)

        missing_cols = [c for c in all_mapped if c not in df.columns]
        if missing_cols:
            errors.append({
                "code": "missing_columns",
                "message": f"Mapped columns not found in data: {', '.join(missing_cols)}.",
                "severity": "error",
            })
            # Return early -- further checks would fail
            return {
                "is_valid": False,
                "errors": errors,
                "warnings": warnings,
                "suggestions": suggestions,
                "data_summary": self._build_summary(df, mapping, media_cols, control_cols),
            }

        if target_col and target_col in df.columns:
            target_vals = pd.to_numeric(df[target_col], errors="coerce")
            if target_vals.sum() == 0:
                errors.append({
                    "code": "target_all_zero",
                    "message": f"Target column '{target_col}' is all zeros.",
                    "column": target_col,
                    "severity": "error",
                })
            if target_vals.isna().all():
                errors.append({
                    "code": "target_not_numeric",
                    "message": f"Target column '{target_col}' contains no numeric values.",
                    "column": target_col,
                    "severity": "error",
                })

        for col in media_cols:
            if col in df.columns:
                vals = pd.to_numeric(df[col], errors="coerce")
                if (vals < 0).any():
                    errors.append({
                        "code": "negative_spend",
                        "message": f"Negative values in '{col}' -- spend cannot be negative.",
                        "column": col,
                        "severity": "error",
                    })
                if vals.isna().all():
                    errors.append({
                        "code": "media_not_numeric",
                        "message": f"Media column '{col}' contains no numeric values.",
                        "column": col,
                        "severity": "error",
                    })

        # Check date column validity and gaps
        if date_col and date_col in df.columns:
            dates = pd.to_datetime(df[date_col], errors="coerce")
            invalid_count = dates.isna().sum()
            if invalid_count > 0:
                errors.append({
                    "code": "invalid_dates",
                    "message": f"{invalid_count} value(s) in '{date_col}' are not valid dates.",
                    "column": date_col,
                    "severity": "error",
                })
            else:
                # Date gap analysis
                gap_info = self._detect_date_gaps(dates)
                if gap_info["has_gaps"]:
                    errors.append({
                        "code": "date_gaps",
                        "message": (
                            f"Missing dates detected: {gap_info['gap_count']} gap(s). "
                            f"Largest gap: {gap_info['max_gap_days']} days "
                            f"(around {gap_info['first_gap_date']}). "
                            f"Fill or interpolate these."
                        ),
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

        # Frequency detection warning
        if date_col and date_col in df.columns:
            dates_clean = pd.to_datetime(df[date_col], errors="coerce").dropna()
            if len(dates_clean) >= 2:
                freq_info = self._detect_frequency(dates_clean)
                if freq_info["detected"] != "weekly":
                    warnings.append({
                        "code": "non_weekly",
                        "message": (
                            f"Date intervals aren't consistent with weekly data. "
                            f"Detected: {freq_info['detected']} "
                            f"(median interval: {freq_info['median_days']:.0f} days). "
                            f"The model expects weekly frequency."
                        ),
                        "severity": "warning",
                    })

        # Check nulls and variance on all numeric columns
        check_cols = [c for c in media_cols + [target_col] + control_cols if c and c in df.columns]
        for col in check_cols:
            vals = pd.to_numeric(df[col], errors="coerce")
            null_pct = vals.isna().mean() * 100
            if null_pct > 5:
                warnings.append({
                    "code": "high_nulls",
                    "message": f"Column '{col}' has {null_pct:.0f}% missing values. Consider imputation.",
                    "column": col,
                    "severity": "warning",
                })
            if vals.dropna().std() == 0 and len(vals.dropna()) > 0:
                warnings.append({
                    "code": "zero_variance",
                    "message": f"Column '{col}' has no variation -- it won't add predictive value.",
                    "column": col,
                    "severity": "warning",
                })

        # Check high correlations between media columns
        if len(media_cols) >= 2:
            numeric_media = df[media_cols].apply(pd.to_numeric, errors="coerce")
            valid_cols = [c for c in numeric_media.columns if numeric_media[c].std() > 0]
            if len(valid_cols) >= 2:
                corr_matrix = numeric_media[valid_cols].corr()
                for i in range(len(corr_matrix.columns)):
                    for j in range(i + 1, len(corr_matrix.columns)):
                        r = abs(corr_matrix.iloc[i, j])
                        if r > 0.7:
                            col1 = corr_matrix.columns[i]
                            col2 = corr_matrix.columns[j]
                            warnings.append({
                                "code": "high_correlation",
                                "message": (
                                    f"'{col1}' and '{col2}' are {r:.0%} correlated "
                                    f"-- may cause multicollinearity."
                                ),
                                "severity": "warning",
                            })

        # Check outliers in target
        if target_col and target_col in df.columns:
            values = pd.to_numeric(df[target_col], errors="coerce").dropna()
            if len(values) > 0:
                mean, std = values.mean(), values.std()
                if std > 0:
                    outlier_count = int(((values - mean).abs() > 3 * std).sum())
                    if outlier_count > 0:
                        warnings.append({
                            "code": "outliers",
                            "message": (
                                f"{outlier_count} outlier week(s) detected in "
                                f"'{target_col}' (>3 std from mean)."
                            ),
                            "column": target_col,
                            "severity": "warning",
                        })

        # Check if any media channel is all zeros (no spend)
        for col in media_cols:
            if col in df.columns:
                vals = pd.to_numeric(df[col], errors="coerce").fillna(0)
                if vals.sum() == 0:
                    warnings.append({
                        "code": "zero_spend_channel",
                        "message": f"Channel '{col}' has zero total spend. It will not contribute to the model.",
                        "column": col,
                        "severity": "warning",
                    })

        # --- SUGGESTIONS ---

        has_seasonal = any(
            "holiday" in c.lower() or "season" in c.lower()
            for c in control_cols
        )
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
                    "message": (
                        f"Target '{target_col}' is highly skewed (skew={skew:.1f}). "
                        f"Log transform may improve fit."
                    ),
                    "column": target_col,
                    "severity": "suggestion",
                })

        # Suggest more channels
        if len(media_cols) < 3:
            suggestions.append({
                "code": "few_channels",
                "message": (
                    f"Only {len(media_cols)} media channel(s) mapped. "
                    f"More channels give richer insights."
                ),
                "severity": "suggestion",
            })

        # Spend scale difference info
        if len(media_cols) >= 2:
            spend_means = []
            for col in media_cols:
                if col in df.columns:
                    m = pd.to_numeric(df[col], errors="coerce").mean()
                    if m and m > 0:
                        spend_means.append(m)
            if len(spend_means) >= 2:
                ratio = max(spend_means) / min(spend_means)
                if ratio > 100:
                    suggestions.append({
                        "code": "normalize",
                        "message": (
                            "Spend columns have very different scales "
                            f"({ratio:.0f}x difference). "
                            "The model handles this, but FYI."
                        ),
                        "severity": "suggestion",
                    })

        data_summary = self._build_summary(df, mapping, media_cols, control_cols)

        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "suggestions": suggestions,
            "data_summary": data_summary,
        }

    def _detect_date_gaps(self, dates: pd.Series) -> dict:
        """Detect gaps in a date series relative to the dominant frequency."""
        dates_sorted = dates.sort_values().reset_index(drop=True)
        diffs = dates_sorted.diff().dropna()

        if len(diffs) == 0:
            return {"has_gaps": False, "gap_count": 0, "max_gap_days": 0, "first_gap_date": ""}

        median_diff = diffs.median()
        # A gap is any interval > 1.5x the median
        threshold = median_diff * 1.5
        gaps = diffs[diffs > threshold]

        if len(gaps) == 0:
            return {"has_gaps": False, "gap_count": 0, "max_gap_days": 0, "first_gap_date": ""}

        max_gap_days = int(gaps.max().days)
        first_gap_idx = gaps.index[0]
        first_gap_date = str(dates_sorted.iloc[first_gap_idx - 1].date()) if first_gap_idx > 0 else ""

        return {
            "has_gaps": True,
            "gap_count": len(gaps),
            "max_gap_days": max_gap_days,
            "first_gap_date": first_gap_date,
        }

    def _detect_frequency(self, dates: pd.Series) -> dict:
        """Detect the data frequency (daily/weekly/monthly)."""
        dates_sorted = dates.sort_values().reset_index(drop=True)
        diffs = dates_sorted.diff().dropna()

        if len(diffs) == 0:
            return {"detected": "unknown", "median_days": 0}

        median_days = diffs.dt.days.median()

        if 1 <= median_days <= 2:
            detected = "daily"
        elif 5 <= median_days <= 9:
            detected = "weekly"
        elif 26 <= median_days <= 35:
            detected = "monthly"
        else:
            detected = f"irregular ({median_days:.0f}-day intervals)"

        return {"detected": detected, "median_days": float(median_days)}

    def _build_summary(
        self, df: pd.DataFrame, mapping: dict, media_cols: list, control_cols: list
    ) -> dict:
        date_col = mapping.get("date_column", "")
        target_col = mapping.get("target_column", "")

        dates = pd.to_datetime(df.get(date_col, pd.Series()), errors="coerce").dropna()
        target_vals = pd.to_numeric(df.get(target_col, pd.Series()), errors="coerce").dropna()

        total_spend = 0.0
        channel_spends = {}
        for col in media_cols:
            if col in df.columns:
                s = float(pd.to_numeric(df[col], errors="coerce").sum())
                channel_spends[col] = s
                total_spend += s

        # Detect frequency
        freq = "unknown"
        if len(dates) >= 2:
            freq_info = self._detect_frequency(dates)
            freq = freq_info["detected"]

        return {
            "row_count": len(df),
            "date_range_start": dates.min().isoformat() if len(dates) > 0 else "",
            "date_range_end": dates.max().isoformat() if len(dates) > 0 else "",
            "frequency": freq,
            "media_channel_count": len(media_cols),
            "control_variable_count": len(control_cols),
            "total_media_spend": float(total_spend),
            "channel_spends": channel_spends,
            "avg_target_value": float(target_vals.mean()) if len(target_vals) > 0 else 0.0,
            "target_sum": float(target_vals.sum()) if len(target_vals) > 0 else 0.0,
        }
