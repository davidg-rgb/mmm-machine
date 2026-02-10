from dataclasses import dataclass, field
from typing import Any

import pandas as pd


@dataclass
class PreparedData:
    df: pd.DataFrame
    media_columns: list[str]
    control_columns: list[str]
    target_column: str
    date_column: str


@dataclass
class ChannelContribution:
    channel: str
    mean: float
    median: float
    hdi_3: float
    hdi_97: float
    share_of_total: float


@dataclass
class ChannelROAS:
    channel: str
    mean: float
    median: float
    hdi_3: float
    hdi_97: float


@dataclass
class AdstockResult:
    channel: str
    type: str
    alpha: float | None = None
    shape: float | None = None
    scale: float | None = None
    mean_lag_weeks: float = 0.0


@dataclass
class SaturationResult:
    channel: str
    type: str
    lam: float | None = None
    k: float | None = None
    s: float | None = None
    saturation_pct: float = 0.0


@dataclass
class Diagnostics:
    r_squared: float
    mape: float
    r_hat_max: float
    ess_min: float
    divergences: int
    convergence_status: str


@dataclass
class DecompositionTS:
    dates: list[str]
    actual: list[float]
    predicted: list[float]
    predicted_hdi_lower: list[float]
    predicted_hdi_upper: list[float]
    base: list[float]
    channels: dict[str, list[float]] = field(default_factory=dict)


@dataclass
class EngineResults:
    diagnostics: Diagnostics
    base_sales_pct: float
    base_sales_weekly_mean: float
    channel_contributions: list[ChannelContribution]
    channel_roas: list[ChannelROAS]
    adstock_params: list[AdstockResult]
    saturation_params: list[SaturationResult]
    decomposition_ts: DecompositionTS
    summary_text: str = ""
    top_recommendation: str = ""
