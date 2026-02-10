"""Budget optimization service (Phase 2 - stub for MVP)."""


class BudgetOptimizer:
    """Finds optimal budget allocation across channels using fitted MMM.

    Phase 2 implementation. Stub provided for API contract readiness.
    """

    def optimize(
        self,
        model_results: dict,
        total_budget: float,
        min_per_channel: dict[str, float] | None = None,
        max_per_channel: dict[str, float] | None = None,
    ) -> dict:
        # Phase 2: Will use scipy.optimize or PyMC-Marketing's built-in optimizer
        raise NotImplementedError("Budget optimization is a Phase 2 feature")
