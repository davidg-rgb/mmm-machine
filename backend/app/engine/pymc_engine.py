"""PyMC-Marketing MMM Engine implementation.

This is the primary engine for Phase 1 MVP.
Wraps pymc_marketing.mmm.MMM with our BaseMMM interface.
"""

import io
import pickle
from typing import Callable

import numpy as np
import pandas as pd

from app.engine.base import BaseMMM
from app.engine.types import (
    AdstockResult,
    ChannelContribution,
    ChannelROAS,
    DecompositionTS,
    Diagnostics,
    EngineResults,
    PreparedData,
    SaturationResult,
)


class PyMCMMMEngine(BaseMMM):
    """PyMC-Marketing MMM engine implementation."""

    def __init__(self, config: dict):
        super().__init__(config)
        self.model = None
        self.trace = None

    def prepare_data(self, df: pd.DataFrame, mapping: dict) -> PreparedData:
        date_col = mapping["date_column"]
        target_col = mapping["target_column"]
        media_cols = list(mapping["media_columns"].keys())
        control_cols = mapping.get("control_columns", [])

        df = df.copy()
        df[date_col] = pd.to_datetime(df[date_col])
        df = df.sort_values(date_col).reset_index(drop=True)

        # Ensure numeric types
        for col in media_cols + control_cols + [target_col]:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        # Forward-fill small gaps
        df = df.ffill().bfill()

        return PreparedData(
            df=df,
            media_columns=media_cols,
            control_columns=control_cols,
            target_column=target_col,
            date_column=date_col,
        )

    def build_model(self, data: PreparedData) -> None:
        import pymc_marketing.mmm as pmm

        adstock_type = self.config.get("adstock_type", "geometric")
        saturation_type = self.config.get("saturation_type", "logistic")

        if adstock_type == "geometric":
            adstock = pmm.GeometricAdstock(l_max=8)
        else:
            adstock = pmm.WeibullAdstock(l_max=8)

        if saturation_type == "logistic":
            saturation = pmm.LogisticSaturation()
        else:
            saturation = pmm.HillSaturation()

        self.model = pmm.MMM(
            date_column=data.date_column,
            channel_columns=data.media_columns,
            control_columns=data.control_columns if data.control_columns else None,
            adstock=adstock,
            saturation=saturation,
            yearly_seasonality=self.config.get("yearly_seasonality", 2),
        )

    def fit(
        self,
        data: PreparedData,
        progress_callback: Callable[[int, str], None] | None = None,
    ) -> None:
        if progress_callback:
            progress_callback(5, "Starting MCMC sampling...")

        n_samples = self.config.get("n_samples", 2000)
        n_chains = self.config.get("n_chains", 4)
        target_accept = self.config.get("target_accept", 0.9)

        self.model.fit(
            X=data.df,
            y=data.df[data.target_column].values,
            target_accept=target_accept,
            chains=n_chains,
            draws=n_samples,
            tune=min(n_samples, 1000),
            random_seed=42,
        )
        self.trace = self.model.idata

        if progress_callback:
            progress_callback(90, "Sampling complete, extracting results...")

    def extract_results(self) -> EngineResults:
        import arviz as az

        # Diagnostics
        r_hat = az.rhat(self.trace)
        ess = az.ess(self.trace)
        r_hat_max = float(max(r_hat.max().values()))
        ess_min = float(min(ess.min().values()))
        divergences = int(self.trace.sample_stats.diverging.sum().values)

        if r_hat_max <= 1.05 and divergences == 0:
            convergence = "good"
        elif r_hat_max <= 1.1:
            convergence = "acceptable"
        else:
            convergence = "poor"

        # Model fit
        posterior_pred = self.model.sample_posterior_predictive()
        r2 = float(az.r2_score(self.trace).r2.mean())

        diagnostics = Diagnostics(
            r_squared=r2,
            mape=0.0,  # TODO: compute MAPE
            r_hat_max=r_hat_max,
            ess_min=ess_min,
            divergences=divergences,
            convergence_status=convergence,
        )

        # Channel contributions
        contributions_data = self.model.compute_channel_contribution_original_scale()
        channel_contributions = []
        total_contribution = 0.0

        for i, ch in enumerate(self.model.channel_columns):
            ch_vals = contributions_data[:, :, i].flatten()
            mean_val = float(np.mean(ch_vals))
            total_contribution += mean_val
            channel_contributions.append(
                ChannelContribution(
                    channel=ch,
                    mean=mean_val,
                    median=float(np.median(ch_vals)),
                    hdi_3=float(np.percentile(ch_vals, 3)),
                    hdi_97=float(np.percentile(ch_vals, 97)),
                    share_of_total=0.0,  # computed below
                )
            )

        # Compute shares
        for cc in channel_contributions:
            if total_contribution > 0:
                cc.share_of_total = cc.mean / total_contribution

        # ROAS (placeholder — proper computation requires spend data)
        channel_roas = [
            ChannelROAS(channel=cc.channel, mean=0.0, median=0.0, hdi_3=0.0, hdi_97=0.0)
            for cc in channel_contributions
        ]

        # Adstock params (placeholder)
        adstock_params = [
            AdstockResult(
                channel=ch,
                type=self.config.get("adstock_type", "geometric"),
                mean_lag_weeks=0.0,
            )
            for ch in self.model.channel_columns
        ]

        # Saturation params (placeholder)
        saturation_params = [
            SaturationResult(
                channel=ch,
                type=self.config.get("saturation_type", "logistic"),
            )
            for ch in self.model.channel_columns
        ]

        # Decomposition time series (placeholder)
        decomposition_ts = DecompositionTS(
            dates=[],
            actual=[],
            predicted=[],
            predicted_hdi_lower=[],
            predicted_hdi_upper=[],
            base=[],
            channels={},
        )

        return EngineResults(
            diagnostics=diagnostics,
            base_sales_pct=0.0,
            base_sales_weekly_mean=0.0,
            channel_contributions=channel_contributions,
            channel_roas=channel_roas,
            adstock_params=adstock_params,
            saturation_params=saturation_params,
            decomposition_ts=decomposition_ts,
        )

    def serialize_model(self) -> bytes:
        buf = io.BytesIO()
        pickle.dump({"trace": self.trace, "config": self.config}, buf)
        return buf.getvalue()

    def get_diagnostics(self) -> dict:
        results = self.extract_results()
        return {
            "r_squared": results.diagnostics.r_squared,
            "r_hat_max": results.diagnostics.r_hat_max,
            "ess_min": results.diagnostics.ess_min,
            "divergences": results.diagnostics.divergences,
            "convergence_status": results.diagnostics.convergence_status,
        }
