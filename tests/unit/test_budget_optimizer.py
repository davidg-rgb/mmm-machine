"""Tests for the budget optimizer service."""

import pytest

from app.services.budget_optimizer import BudgetOptimizer


@pytest.fixture
def sample_response_curves():
    """Response curves data as would be stored in model results."""
    return {
        "google_ads": {
            "spend_levels": [0, 500, 1000, 1500, 2000, 2500, 3000],
            "predicted_contribution": [0, 800, 1400, 1800, 2050, 2200, 2300],
            "current_spend": 1500,
            "current_contribution": 1800,
        },
        "facebook": {
            "spend_levels": [0, 500, 1000, 1500, 2000, 2500, 3000],
            "predicted_contribution": [0, 600, 1100, 1500, 1700, 1850, 1950],
            "current_spend": 1000,
            "current_contribution": 1100,
        },
        "tv": {
            "spend_levels": [0, 500, 1000, 1500, 2000, 2500, 3000],
            "predicted_contribution": [0, 400, 700, 950, 1150, 1300, 1400],
            "current_spend": 500,
            "current_contribution": 400,
        },
    }


@pytest.fixture
def model_results(sample_response_curves):
    return {"response_curves": sample_response_curves}


class TestBudgetOptimizer:
    def test_returns_expected_keys(self, model_results):
        optimizer = BudgetOptimizer()
        result = optimizer.optimize(model_results, total_budget=3000)
        assert "allocations" in result
        assert "predicted_contributions" in result
        assert "total_predicted_contribution" in result
        assert "current_allocations" in result
        assert "current_contributions" in result
        assert "total_current_contribution" in result
        assert "improvement_pct" in result

    def test_allocations_sum_to_budget(self, model_results):
        optimizer = BudgetOptimizer()
        result = optimizer.optimize(model_results, total_budget=3000)
        total = sum(result["allocations"].values())
        assert abs(total - 3000) < 1.0  # Allow small floating point error

    def test_all_channels_present(self, model_results, sample_response_curves):
        optimizer = BudgetOptimizer()
        result = optimizer.optimize(model_results, total_budget=3000)
        for ch in sample_response_curves:
            assert ch in result["allocations"]
            assert ch in result["predicted_contributions"]
            assert ch in result["current_allocations"]
            assert ch in result["current_contributions"]

    def test_improvement_pct_is_float(self, model_results):
        optimizer = BudgetOptimizer()
        result = optimizer.optimize(model_results, total_budget=3000)
        assert isinstance(result["improvement_pct"], float)

    def test_optimal_beats_or_matches_current(self, model_results):
        optimizer = BudgetOptimizer()
        result = optimizer.optimize(model_results, total_budget=3000)
        assert result["total_predicted_contribution"] >= result["total_current_contribution"] - 1.0

    def test_respects_min_constraint(self, model_results):
        optimizer = BudgetOptimizer()
        result = optimizer.optimize(
            model_results,
            total_budget=3000,
            min_per_channel={"tv": 1000},
        )
        assert result["allocations"]["tv"] >= 999.0  # Allow small floating point

    def test_respects_max_constraint(self, model_results):
        optimizer = BudgetOptimizer()
        result = optimizer.optimize(
            model_results,
            total_budget=3000,
            max_per_channel={"google_ads": 500},
        )
        assert result["allocations"]["google_ads"] <= 501.0  # Allow small floating point

    def test_raises_on_missing_curves(self):
        optimizer = BudgetOptimizer()
        with pytest.raises(ValueError, match="No response curves"):
            optimizer.optimize({}, total_budget=3000)

    def test_different_budget_levels(self, model_results):
        optimizer = BudgetOptimizer()
        result_low = optimizer.optimize(model_results, total_budget=1000)
        result_high = optimizer.optimize(model_results, total_budget=5000)
        assert abs(sum(result_low["allocations"].values()) - 1000) < 1.0
        assert abs(sum(result_high["allocations"].values()) - 5000) < 1.0
