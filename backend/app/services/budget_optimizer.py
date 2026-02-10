"""Budget optimization service using scipy SLSQP and response curves."""

import logging

import numpy as np
from scipy.optimize import minimize

logger = logging.getLogger(__name__)


class BudgetOptimizer:
    """Finds optimal budget allocation across channels using fitted MMM response curves."""

    def optimize(
        self,
        model_results: dict,
        total_budget: float,
        min_per_channel: dict[str, float] | None = None,
        max_per_channel: dict[str, float] | None = None,
    ) -> dict:
        response_curves = model_results.get("response_curves", {})
        if not response_curves:
            raise ValueError("No response curves available for optimization")

        channels = sorted(response_curves.keys())
        n = len(channels)

        # Build interpolation data per channel
        spend_arrays = {}
        contrib_arrays = {}
        current_spends = {}
        for ch in channels:
            curve = response_curves[ch]
            spend_arrays[ch] = np.array(curve["spend_levels"])
            contrib_arrays[ch] = np.array(curve["predicted_contribution"])
            current_spends[ch] = curve["current_spend"]

        def _interp_contribution(channel: str, spend: float) -> float:
            return float(np.interp(spend, spend_arrays[channel], contrib_arrays[channel]))

        # Objective: minimize negative total contribution (= maximize contribution)
        def objective(x):
            total = 0.0
            for i, ch in enumerate(channels):
                total += _interp_contribution(ch, x[i])
            return -total

        # Constraint: sum of allocations == total_budget
        constraints = [{"type": "eq", "fun": lambda x: np.sum(x) - total_budget}]

        # Bounds per channel
        bounds = []
        for ch in channels:
            lo = (min_per_channel or {}).get(ch, 0.0)
            hi = (max_per_channel or {}).get(ch, total_budget)
            bounds.append((lo, hi))

        # Initial guess: distribute proportionally to current spend, or equally
        total_current = sum(current_spends[ch] for ch in channels)
        if total_current > 0:
            x0 = np.array([current_spends[ch] / total_current * total_budget for ch in channels])
        else:
            x0 = np.full(n, total_budget / n)

        result = minimize(
            objective,
            x0,
            method="SLSQP",
            bounds=bounds,
            constraints=constraints,
            options={"maxiter": 1000, "ftol": 1e-9},
        )

        if not result.success:
            logger.warning("Budget optimization did not converge: %s", result.message)

        # Build output
        allocations = {}
        predicted_contributions = {}
        for i, ch in enumerate(channels):
            allocations[ch] = float(result.x[i])
            predicted_contributions[ch] = _interp_contribution(ch, result.x[i])

        current_allocations = {ch: current_spends[ch] for ch in channels}
        current_contributions = {
            ch: _interp_contribution(ch, current_spends[ch]) for ch in channels
        }

        total_predicted = sum(predicted_contributions.values())
        total_current = sum(current_contributions.values())
        improvement_pct = (
            (total_predicted - total_current) / total_current * 100
            if total_current > 0
            else 0.0
        )

        return {
            "allocations": allocations,
            "predicted_contributions": predicted_contributions,
            "total_predicted_contribution": total_predicted,
            "current_allocations": current_allocations,
            "current_contributions": current_contributions,
            "total_current_contribution": total_current,
            "improvement_pct": improvement_pct,
        }
