"""Unit tests for the DataValidator service."""

import numpy as np
import pandas as pd
import pytest

from app.services.data_validator import DataValidator


@pytest.fixture
def validator():
    return DataValidator()


@pytest.fixture
def valid_mapping():
    return {
        "date_column": "week_start",
        "target_column": "revenue",
        "media_columns": {
            "tv_spend": {"channel_name": "TV", "spend_type": "spend"},
            "meta_spend": {"channel_name": "Meta", "spend_type": "spend"},
        },
        "control_columns": ["temperature", "holiday_flag"],
    }


def _make_df(n_weeks: int = 104, seed: int = 42) -> pd.DataFrame:
    """Helper to generate a valid baseline dataframe."""
    rng = np.random.default_rng(seed)
    dates = pd.date_range(start="2022-01-03", periods=n_weeks, freq="W-MON")
    return pd.DataFrame(
        {
            "week_start": dates,
            "revenue": rng.normal(50000, 5000, n_weeks).clip(min=1),
            "tv_spend": rng.lognormal(10, 0.5, n_weeks),
            "meta_spend": rng.lognormal(9, 0.5, n_weeks),
            "temperature": 15 + 10 * np.sin(2 * np.pi * np.arange(n_weeks) / 52),
            "holiday_flag": np.zeros(n_weeks),
        }
    )


# ---------------------------------------------------------------------------
# Valid data passes
# ---------------------------------------------------------------------------


class TestValidData:
    def test_valid_104_week_dataset(self, validator, valid_mapping):
        df = _make_df(104)
        result = validator.validate(df, valid_mapping)
        assert result["is_valid"] is True
        assert len(result["errors"]) == 0

    def test_valid_data_has_summary(self, validator, valid_mapping):
        df = _make_df(104)
        result = validator.validate(df, valid_mapping)
        summary = result["data_summary"]
        assert summary["row_count"] == 104
        assert summary["media_channel_count"] == 2
        assert summary["control_variable_count"] == 2
        assert summary["total_media_spend"] > 0
        assert summary["avg_target_value"] > 0


# ---------------------------------------------------------------------------
# Error conditions (blocking)
# ---------------------------------------------------------------------------


class TestErrors:
    def test_too_few_rows(self, validator, valid_mapping):
        df = _make_df(30)
        result = validator.validate(df, valid_mapping)
        assert result["is_valid"] is False
        error_codes = [e["code"] for e in result["errors"]]
        assert "min_rows" in error_codes

    def test_negative_spend(self, validator, valid_mapping):
        df = _make_df(104)
        df.loc[0, "tv_spend"] = -100.0
        result = validator.validate(df, valid_mapping)
        assert result["is_valid"] is False
        error_codes = [e["code"] for e in result["errors"]]
        assert "negative_spend" in error_codes

    def test_all_zero_target(self, validator, valid_mapping):
        df = _make_df(104)
        df["revenue"] = 0.0
        result = validator.validate(df, valid_mapping)
        assert result["is_valid"] is False
        error_codes = [e["code"] for e in result["errors"]]
        assert "target_all_zero" in error_codes

    def test_no_media_columns(self, validator):
        df = _make_df(104)
        mapping = {
            "date_column": "week_start",
            "target_column": "revenue",
            "media_columns": {},
            "control_columns": [],
        }
        result = validator.validate(df, mapping)
        assert result["is_valid"] is False
        error_codes = [e["code"] for e in result["errors"]]
        assert "no_media_cols" in error_codes

    def test_invalid_dates(self, validator, valid_mapping):
        df = _make_df(104)
        df.loc[0, "week_start"] = "not-a-date"
        result = validator.validate(df, valid_mapping)
        error_codes = [e["code"] for e in result["errors"]]
        assert "invalid_dates" in error_codes


# ---------------------------------------------------------------------------
# Warning conditions (non-blocking)
# ---------------------------------------------------------------------------


class TestWarnings:
    def test_low_row_count_warning(self, validator, valid_mapping):
        df = _make_df(60)
        result = validator.validate(df, valid_mapping)
        assert result["is_valid"] is True  # Not blocking
        warning_codes = [w["code"] for w in result["warnings"]]
        assert "low_rows" in warning_codes

    def test_high_correlation_warning(self, validator, valid_mapping):
        df = _make_df(104)
        # Make meta_spend nearly identical to tv_spend
        df["meta_spend"] = df["tv_spend"] * 1.01 + 0.5
        result = validator.validate(df, valid_mapping)
        warning_codes = [w["code"] for w in result["warnings"]]
        assert "high_correlation" in warning_codes

    def test_missing_values_warning(self, validator, valid_mapping):
        df = _make_df(104)
        # Set 10% of revenue to NaN
        df.loc[df.index[:11], "revenue"] = np.nan
        result = validator.validate(df, valid_mapping)
        warning_codes = [w["code"] for w in result["warnings"]]
        assert "high_nulls" in warning_codes

    def test_zero_variance_warning(self, validator, valid_mapping):
        df = _make_df(104)
        df["temperature"] = 20.0  # Constant value
        result = validator.validate(df, valid_mapping)
        warning_codes = [w["code"] for w in result["warnings"]]
        assert "zero_variance" in warning_codes


# ---------------------------------------------------------------------------
# Suggestions
# ---------------------------------------------------------------------------


class TestSuggestions:
    def test_no_seasonality_suggestion(self, validator):
        df = _make_df(104)
        mapping = {
            "date_column": "week_start",
            "target_column": "revenue",
            "media_columns": {
                "tv_spend": {"channel_name": "TV", "spend_type": "spend"},
            },
            "control_columns": ["temperature"],  # No holiday/season variable
        }
        result = validator.validate(df, mapping)
        suggestion_codes = [s["code"] for s in result["suggestions"]]
        assert "add_seasonality" in suggestion_codes

    def test_skewed_target_suggestion(self, validator, valid_mapping):
        df = _make_df(104)
        # Create highly skewed target
        df["revenue"] = np.exp(np.random.default_rng(42).normal(10, 2, 104))
        result = validator.validate(df, valid_mapping)
        suggestion_codes = [s["code"] for s in result["suggestions"]]
        assert "log_transform" in suggestion_codes
