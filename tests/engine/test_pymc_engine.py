"""Integration test for the PyMC-Marketing MMM engine.

This test runs the full engine pipeline with synthetic data and verifies
that the engine can prepare, build, fit, and extract results. Uses quick
mode (500 draws, 2 chains) to keep CI time reasonable.

Marked as slow — skip with: pytest -m "not slow"
"""

import pytest

from tests.fixtures.synthetic_data import generate_synthetic_dataset


@pytest.mark.slow
class TestPyMCEngine:
    """Full pipeline integration test for PyMCMMMEngine."""

    @pytest.fixture(scope="class")
    def synthetic_data(self):
        """Generate synthetic dataset with known ground truth."""
        df, ground_truth = generate_synthetic_dataset(n_weeks=104, n_channels=4)
        mapping = {
            "date_column": "week_start",
            "target_column": "revenue",
            "media_columns": {
                "tv_spend": {"channel_name": "TV", "spend_type": "spend"},
                "meta_spend": {"channel_name": "Meta", "spend_type": "spend"},
                "search_spend": {"channel_name": "Search", "spend_type": "spend"},
                "radio_spend": {"channel_name": "Radio", "spend_type": "spend"},
            },
            "control_columns": ["temperature", "holiday_flag"],
        }
        return df, mapping, ground_truth

    @pytest.fixture(scope="class")
    def engine_config(self):
        """Quick-mode engine configuration for CI."""
        return {
            "adstock_type": "geometric",
            "saturation_type": "logistic",
            "n_samples": 500,
            "n_chains": 2,
            "target_accept": 0.85,
            "yearly_seasonality": 2,
        }

    def test_prepare_data(self, synthetic_data, engine_config):
        from app.engine.pymc_engine import PyMCMMMEngine

        df, mapping, _ = synthetic_data
        engine = PyMCMMMEngine(engine_config)
        prepared = engine.prepare_data(df, mapping)

        assert prepared.df is not None
        assert len(prepared.df) == 104
        assert prepared.media_columns == [
            "tv_spend",
            "meta_spend",
            "search_spend",
            "radio_spend",
        ]
        assert prepared.target_column == "revenue"
        assert prepared.date_column == "week_start"
        assert prepared.control_columns == ["temperature", "holiday_flag"]

    def test_build_model(self, synthetic_data, engine_config):
        from app.engine.pymc_engine import PyMCMMMEngine

        df, mapping, _ = synthetic_data
        engine = PyMCMMMEngine(engine_config)
        prepared = engine.prepare_data(df, mapping)
        engine.build_model(prepared)

        assert engine.model is not None

    def test_fit_and_extract(self, synthetic_data, engine_config):
        """Run the full fit + extract pipeline (the main validation test)."""
        from app.engine.pymc_engine import PyMCMMMEngine

        df, mapping, ground_truth = synthetic_data
        engine = PyMCMMMEngine(engine_config)
        prepared = engine.prepare_data(df, mapping)
        engine.build_model(prepared)

        progress_log = []

        def progress_cb(pct, msg):
            progress_log.append((pct, msg))

        engine.fit(prepared, progress_callback=progress_cb)

        assert len(progress_log) > 0
        assert engine.trace is not None

        results = engine.extract_results()

        # Diagnostics should be reasonable
        diag = results.diagnostics
        assert diag.r_hat_max < 1.1, f"R-hat too high: {diag.r_hat_max}"
        assert diag.divergences <= 5, f"Too many divergences: {diag.divergences}"
        assert diag.convergence_status in ("good", "acceptable")
        assert diag.r_squared > 0.3, f"R-squared too low: {diag.r_squared}"

        # Channel contributions should exist for all 4 channels
        assert len(results.channel_contributions) == 4
        channel_names = [cc.channel for cc in results.channel_contributions]
        assert "tv_spend" in channel_names
        assert "meta_spend" in channel_names

        # Shares should sum to ~1
        total_share = sum(cc.share_of_total for cc in results.channel_contributions)
        assert 0.9 < total_share < 1.1

    def test_serialize_model(self, synthetic_data, engine_config):
        """Verify the model can be serialized after fitting."""
        from app.engine.pymc_engine import PyMCMMMEngine

        df, mapping, _ = synthetic_data
        engine = PyMCMMMEngine(engine_config)
        prepared = engine.prepare_data(df, mapping)
        engine.build_model(prepared)
        engine.fit(prepared)

        model_bytes = engine.serialize_model()
        assert isinstance(model_bytes, bytes)
        assert len(model_bytes) > 0

    def test_get_diagnostics(self, synthetic_data, engine_config):
        from app.engine.pymc_engine import PyMCMMMEngine

        df, mapping, _ = synthetic_data
        engine = PyMCMMMEngine(engine_config)
        prepared = engine.prepare_data(df, mapping)
        engine.build_model(prepared)
        engine.fit(prepared)

        diag = engine.get_diagnostics()
        assert "r_squared" in diag
        assert "r_hat_max" in diag
        assert "ess_min" in diag
        assert "divergences" in diag
        assert "convergence_status" in diag
