from abc import ABC, abstractmethod
from typing import Any, Callable

import pandas as pd

from app.engine.types import EngineResults, PreparedData


class BaseMMM(ABC):
    """Abstract base class for MMM engines.

    Designed so alternative engines (Robyn, Meridian, LightweightMMM)
    can be swapped in without changing the API or frontend.
    """

    def __init__(self, config: dict):
        self.config = config

    @abstractmethod
    def prepare_data(self, df: pd.DataFrame, mapping: dict) -> PreparedData:
        """Clean and transform raw data into engine-ready format."""
        ...

    @abstractmethod
    def build_model(self, data: PreparedData) -> None:
        """Construct the statistical model from prepared data."""
        ...

    @abstractmethod
    def fit(
        self,
        data: PreparedData,
        progress_callback: Callable[[int, str], None] | None = None,
    ) -> None:
        """Run model fitting (MCMC sampling).

        progress_callback(percent: int, message: str) is called periodically.
        """
        ...

    @abstractmethod
    def extract_results(self) -> EngineResults:
        """Extract all results after fitting."""
        ...

    @abstractmethod
    def serialize_model(self) -> bytes:
        """Serialize the fitted model for storage."""
        ...

    @abstractmethod
    def get_diagnostics(self) -> dict:
        """Return convergence diagnostics."""
        ...
