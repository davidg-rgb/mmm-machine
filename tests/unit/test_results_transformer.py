"""Tests for the results transformer service."""

import pytest

from app.engine.types import (
    AdstockResult,
    ChannelContribution,
    ChannelROAS,
    DecompositionTS,
    Diagnostics,
    EngineResults,
    SaturationResult,
)
from app.services.results_transformer import transform_results


@pytest.fixture
def sample_engine_results():
    """Create a sample EngineResults for testing."""
    return EngineResults(
        diagnostics=Diagnostics(
            r_squared=0.92,
            mape=8.5,
            r_hat_max=1.01,
            ess_min=500.0,
            divergences=0,
            convergence_status="good",
        ),
        base_sales_pct=0.35,
        base_sales_weekly_mean=50000.0,
        channel_contributions=[
            ChannelContribution(
                channel="Google Ads",
                mean=15000.0,
                median=14800.0,
                hdi_3=12000.0,
                hdi_97=18000.0,
                share_of_total=0.45,
            ),
            ChannelContribution(
                channel="Facebook",
                mean=10000.0,
                median=9800.0,
                hdi_3=8000.0,
                hdi_97=12000.0,
                share_of_total=0.30,
            ),
        ],
        channel_roas=[
            ChannelROAS(
                channel="Google Ads",
                mean=3.5,
                median=3.4,
                hdi_3=2.8,
                hdi_97=4.2,
            ),
            ChannelROAS(
                channel="Facebook",
                mean=2.1,
                median=2.0,
                hdi_3=1.5,
                hdi_97=2.7,
            ),
        ],
        adstock_params=[
            AdstockResult(
                channel="Google Ads",
                type="geometric",
                alpha=0.7,
                mean_lag_weeks=2.3,
            ),
            AdstockResult(
                channel="Facebook",
                type="geometric",
                alpha=0.5,
                mean_lag_weeks=1.0,
            ),
        ],
        saturation_params=[
            SaturationResult(
                channel="Google Ads",
                type="logistic",
                lam=0.5,
                saturation_pct=0.65,
            ),
            SaturationResult(
                channel="Facebook",
                type="logistic",
                lam=0.8,
                saturation_pct=0.40,
            ),
        ],
        decomposition_ts=DecompositionTS(
            dates=["2024-01-01", "2024-01-08"],
            actual=[100000.0, 105000.0],
            predicted=[99000.0, 104000.0],
            predicted_hdi_lower=[95000.0, 100000.0],
            predicted_hdi_upper=[103000.0, 108000.0],
            base=[50000.0, 51000.0],
            channels={"Google Ads": [30000.0, 32000.0], "Facebook": [19000.0, 21000.0]},
        ),
    )


class TestTransformResults:
    def test_returns_dict(self, sample_engine_results):
        result = transform_results(sample_engine_results)
        assert isinstance(result, dict)

    def test_has_required_keys(self, sample_engine_results):
        result = transform_results(sample_engine_results)
        assert "diagnostics" in result
        assert "base_sales" in result
        assert "channel_results" in result
        assert "decomposition_ts" in result
        assert "summary_text" in result
        assert "top_recommendation" in result

    def test_diagnostics_structure(self, sample_engine_results):
        result = transform_results(sample_engine_results)
        diag = result["diagnostics"]
        assert diag["r_squared"] == 0.92
        assert diag["mape"] == 8.5
        assert diag["convergence_status"] == "good"

    def test_base_sales_structure(self, sample_engine_results):
        result = transform_results(sample_engine_results)
        base = result["base_sales"]
        assert base["weekly_mean"] == 50000.0
        assert base["share_of_total"] == 0.35

    def test_channel_results_merged(self, sample_engine_results):
        result = transform_results(sample_engine_results)
        channels = result["channel_results"]
        assert len(channels) == 2

        google = next(c for c in channels if c["channel"] == "Google Ads")
        assert google["contribution_share"] == 0.45
        assert google["weekly_contribution_mean"] == 15000.0
        assert google["roas"]["mean"] == 3.5
        assert google["roas"]["hdi_3"] == 2.8
        assert google["adstock_params"]["type"] == "geometric"
        assert google["adstock_params"]["alpha"] == 0.7
        assert google["saturation_pct"] == 0.65

    def test_summary_generated(self, sample_engine_results):
        result = transform_results(sample_engine_results)
        assert len(result["summary_text"]) > 0
        assert "Google Ads" in result["summary_text"]

    def test_top_recommendation_generated(self, sample_engine_results):
        result = transform_results(sample_engine_results)
        assert len(result["top_recommendation"]) > 0

    def test_channel_recommendations_generated(self, sample_engine_results):
        result = transform_results(sample_engine_results)
        for ch in result["channel_results"]:
            assert "recommendation" in ch
            assert isinstance(ch["recommendation"], str)

    def test_decomposition_ts_structure(self, sample_engine_results):
        result = transform_results(sample_engine_results)
        ts = result["decomposition_ts"]
        assert ts["dates"] == ["2024-01-01", "2024-01-08"]
        assert len(ts["actual"]) == 2
        assert "Google Ads" in ts["channels"]
