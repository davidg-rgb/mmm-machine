"""PyMC-Marketing MMM Engine implementation.

This is the primary engine for Phase 1 MVP.
Wraps pymc_marketing.mmm.MMM with our BaseMMM interface.
"""

import io
import logging
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

logger = logging.getLogger(__name__)


class PyMCMMMEngine(BaseMMM):
    """PyMC-Marketing MMM engine implementation."""

    def __init__(self, config: dict):
        super().__init__(config)
        self.model = None
        self.trace = None
        self._prepared_data: PreparedData | None = None
        self._spend_data: dict[str, np.ndarray] | None = None

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

        # Forward-fill small gaps, then back-fill, then zero
        all_numeric = media_cols + control_cols + [target_col]
        df[all_numeric] = df[all_numeric].ffill().bfill().fillna(0)

        # Clamp negative spend to zero
        for col in media_cols:
            df[col] = df[col].clip(lower=0)

        prepared = PreparedData(
            df=df,
            media_columns=media_cols,
            control_columns=control_cols,
            target_column=target_col,
            date_column=date_col,
        )
        self._prepared_data = prepared

        # Store raw spend for ROAS calculation
        self._spend_data = {col: df[col].values.copy() for col in media_cols}

        return prepared

    def build_model(self, data: PreparedData) -> None:
        import pymc_marketing.mmm as pmm

        adstock_type = self.config.get("adstock_type", "geometric")
        saturation_type = self.config.get("saturation_type", "logistic")
        l_max = self.config.get("l_max", 8)

        if adstock_type == "weibull":
            adstock = pmm.WeibullAdstock(l_max=l_max)
        else:
            adstock = pmm.GeometricAdstock(l_max=l_max)

        if saturation_type == "hill":
            saturation = pmm.HillSaturation()
        else:
            saturation = pmm.LogisticSaturation()

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
        tune = self.config.get("n_tune", min(n_samples, 1000))

        if progress_callback:
            progress_callback(10, f"Sampling: {n_samples} draws x {n_chains} chains...")

        self.model.fit(
            X=data.df,
            y=data.df[data.target_column].values,
            target_accept=target_accept,
            chains=n_chains,
            draws=n_samples,
            tune=tune,
            random_seed=42,
        )
        self.trace = self.model.idata

        if progress_callback:
            progress_callback(85, "Sampling complete, extracting results...")

    def extract_results(self) -> EngineResults:
        import arviz as az

        data = self._prepared_data
        df = data.df

        # ---- Diagnostics ----
        diagnostics = self._extract_diagnostics()

        if diagnostics.convergence_status == "poor":
            logger.warning(
                "Model convergence is poor (R-hat=%.3f, divergences=%d). "
                "Results may be unreliable.",
                diagnostics.r_hat_max, diagnostics.divergences,
            )

        # ---- Channel contributions ----
        contributions_data = self.model.compute_channel_contribution_original_scale()
        channel_contributions = []
        total_contribution = 0.0
        channel_mean_contributions = {}

        for i, ch in enumerate(self.model.channel_columns):
            ch_vals = contributions_data[:, :, i].flatten()
            mean_val = float(np.mean(ch_vals))
            total_contribution += mean_val
            channel_mean_contributions[ch] = mean_val
            channel_contributions.append(
                ChannelContribution(
                    channel=ch,
                    mean=mean_val,
                    median=float(np.median(ch_vals)),
                    hdi_3=float(np.percentile(ch_vals, 3)),
                    hdi_97=float(np.percentile(ch_vals, 97)),
                    share_of_total=0.0,
                )
            )

        for cc in channel_contributions:
            if total_contribution > 0:
                cc.share_of_total = cc.mean / total_contribution

        # ---- ROAS per channel ----
        channel_roas = self._compute_roas(contributions_data)

        # ---- Adstock parameters ----
        adstock_params = self._extract_adstock_params()

        # ---- Saturation parameters ----
        saturation_params = self._extract_saturation_params()

        # ---- Base sales ----
        actual = df[data.target_column].values
        total_actual_mean = float(np.mean(actual))
        base_weekly_mean = max(0.0, total_actual_mean - total_contribution)
        base_sales_pct = base_weekly_mean / total_actual_mean if total_actual_mean > 0 else 0.0

        # ---- Decomposition time series ----
        decomposition_ts = self._build_decomposition_ts(
            contributions_data, channel_mean_contributions, base_weekly_mean
        )

        # ---- MAPE ----
        predicted = np.array(decomposition_ts.predicted)
        actual_ts = np.array(decomposition_ts.actual)
        nonzero_mask = actual_ts != 0
        if nonzero_mask.any():
            mape = float(np.mean(np.abs((actual_ts[nonzero_mask] - predicted[nonzero_mask]) / actual_ts[nonzero_mask])) * 100)
        else:
            mape = 0.0
        diagnostics.mape = mape

        return EngineResults(
            diagnostics=diagnostics,
            base_sales_pct=base_sales_pct,
            base_sales_weekly_mean=base_weekly_mean,
            channel_contributions=channel_contributions,
            channel_roas=channel_roas,
            adstock_params=adstock_params,
            saturation_params=saturation_params,
            decomposition_ts=decomposition_ts,
        )

    def _extract_diagnostics(self) -> Diagnostics:
        import arviz as az

        r_hat = az.rhat(self.trace)
        ess = az.ess(self.trace)

        # Safely extract max r_hat across all variables
        r_hat_vals = []
        for var in r_hat.data_vars:
            vals = r_hat[var].values
            if np.isfinite(vals).any():
                r_hat_vals.append(float(np.nanmax(vals)))
        r_hat_max = max(r_hat_vals) if r_hat_vals else 1.0

        # Safely extract min ESS
        ess_vals = []
        for var in ess.data_vars:
            vals = ess[var].values
            if np.isfinite(vals).any():
                ess_vals.append(float(np.nanmin(vals)))
        ess_min = min(ess_vals) if ess_vals else 0.0

        # Count divergences
        divergences = 0
        if hasattr(self.trace, "sample_stats") and "diverging" in self.trace.sample_stats:
            divergences = int(self.trace.sample_stats.diverging.sum().values)

        if r_hat_max <= 1.05 and divergences == 0:
            convergence = "good"
        elif r_hat_max <= 1.1:
            convergence = "acceptable"
        else:
            convergence = "poor"

        # R-squared from posterior predictive
        try:
            r2_data = az.r2_score(self.trace)
            r_squared = float(r2_data.r2.mean()) if hasattr(r2_data, "r2") else 0.0
        except Exception:
            r_squared = 0.0

        return Diagnostics(
            r_squared=r_squared,
            mape=0.0,  # filled in later
            r_hat_max=r_hat_max,
            ess_min=ess_min,
            divergences=divergences,
            convergence_status=convergence,
        )

    def _compute_roas(self, contributions_data) -> list[ChannelROAS]:
        """Compute ROAS per channel using contribution posteriors and observed spend."""
        roas_list = []

        for i, ch in enumerate(self.model.channel_columns):
            # contributions_data shape: (chains, draws, time, channels) or (draws, time, channels)
            # We need total contribution per posterior sample
            ch_contribs = contributions_data[:, :, i]  # shape: (samples, time)

            # Sum over time to get total contribution per sample
            if ch_contribs.ndim == 2:
                # (samples, time) -> sum over time
                total_contrib_per_sample = ch_contribs.sum(axis=-1).flatten()
            else:
                total_contrib_per_sample = ch_contribs.flatten()

            # Total spend for this channel
            total_spend = float(self._spend_data[ch].sum()) if self._spend_data and ch in self._spend_data else 1.0

            if total_spend > 0:
                roas_per_sample = total_contrib_per_sample / total_spend
            else:
                roas_per_sample = np.zeros_like(total_contrib_per_sample)

            roas_list.append(ChannelROAS(
                channel=ch,
                mean=float(np.mean(roas_per_sample)),
                median=float(np.median(roas_per_sample)),
                hdi_3=float(np.percentile(roas_per_sample, 3)),
                hdi_97=float(np.percentile(roas_per_sample, 97)),
            ))

        return roas_list

    def _extract_adstock_params(self) -> list[AdstockResult]:
        """Extract adstock parameters from the posterior."""
        adstock_type = self.config.get("adstock_type", "geometric")
        results = []

        posterior = self.trace.posterior

        for ch in self.model.channel_columns:
            if adstock_type == "geometric":
                alpha = self._get_posterior_mean(posterior, "adstock_alpha", ch)
                # Mean lag for geometric: alpha / (1 - alpha)
                mean_lag = alpha / (1 - alpha) if alpha < 1 else 10.0
                results.append(AdstockResult(
                    channel=ch,
                    type="geometric",
                    alpha=alpha,
                    mean_lag_weeks=mean_lag,
                ))
            else:
                shape = self._get_posterior_mean(posterior, "adstock_shape", ch)
                scale = self._get_posterior_mean(posterior, "adstock_scale", ch)
                results.append(AdstockResult(
                    channel=ch,
                    type="weibull",
                    shape=shape,
                    scale=scale,
                    mean_lag_weeks=scale if scale else 0.0,
                ))

        return results

    def _extract_saturation_params(self) -> list[SaturationResult]:
        """Extract saturation parameters from the posterior."""
        saturation_type = self.config.get("saturation_type", "logistic")
        results = []

        posterior = self.trace.posterior

        for i, ch in enumerate(self.model.channel_columns):
            if saturation_type == "logistic":
                lam = self._get_posterior_mean(posterior, "saturation_lam", ch)
                # Estimate saturation % at current average spend
                sat_pct = self._estimate_saturation_pct(ch, i)
                results.append(SaturationResult(
                    channel=ch,
                    type="logistic",
                    lam=lam,
                    saturation_pct=sat_pct,
                ))
            else:
                k = self._get_posterior_mean(posterior, "saturation_k", ch)
                s = self._get_posterior_mean(posterior, "saturation_s", ch)
                sat_pct = self._estimate_saturation_pct(ch, i)
                results.append(SaturationResult(
                    channel=ch,
                    type="hill",
                    k=k,
                    s=s,
                    saturation_pct=sat_pct,
                ))

        return results

    def _get_posterior_mean(self, posterior, param_prefix: str, channel: str) -> float:
        """Safely extract a posterior mean for a given parameter and channel."""
        # PyMC-Marketing names params like "adstock_alpha", "saturation_lam" etc.
        # They may be stored as arrays indexed by channel position
        ch_idx = list(self.model.channel_columns).index(channel)

        for var_name in posterior.data_vars:
            if param_prefix in var_name.lower() or param_prefix.replace("_", "") in var_name.lower():
                vals = posterior[var_name].values
                if vals.ndim >= 2:
                    # (chain, draw) or (chain, draw, channel)
                    if vals.ndim == 3 and vals.shape[-1] > ch_idx:
                        return float(np.mean(vals[:, :, ch_idx]))
                    elif vals.ndim == 2:
                        return float(np.mean(vals))
                else:
                    return float(np.mean(vals))

        return 0.0

    def _estimate_saturation_pct(self, channel: str, ch_idx: int) -> float:
        """Estimate how saturated a channel is at its current average spend."""
        try:
            contributions = self.model.compute_channel_contribution_original_scale()
            ch_contribs_mean = contributions[:, :, ch_idx].mean(axis=0)

            # Compare mean contribution to max contribution across observed range
            if len(ch_contribs_mean) > 0:
                current_mean = float(np.mean(ch_contribs_mean))
                max_val = float(np.max(ch_contribs_mean))
                if max_val > 0:
                    return min(1.0, current_mean / max_val)
        except Exception:
            pass
        return 0.0

    def _build_decomposition_ts(
        self,
        contributions_data,
        channel_mean_contributions: dict,
        base_weekly_mean: float,
    ) -> DecompositionTS:
        """Build the time-series decomposition for charting."""
        data = self._prepared_data
        df = data.df

        dates = df[data.date_column].dt.strftime("%Y-%m-%d").tolist()
        actual = df[data.target_column].values.tolist()

        # Per-channel time series (mean across posterior)
        channels_ts = {}
        for i, ch in enumerate(self.model.channel_columns):
            ch_ts = contributions_data[:, :, i].mean(axis=0)
            if hasattr(ch_ts, "flatten"):
                ch_ts = ch_ts.flatten()
            channels_ts[ch] = [float(v) for v in ch_ts[:len(dates)]]

        # Base = actual - sum of all channel contributions (per time step)
        total_channel_ts = np.zeros(len(dates))
        for ch_vals in channels_ts.values():
            total_channel_ts += np.array(ch_vals[:len(dates)])
        base_ts = np.array(actual) - total_channel_ts
        base_ts = np.clip(base_ts, 0, None)

        # Predicted = base + channels
        predicted = base_ts + total_channel_ts

        # HDI for predictions (simple approximation from posterior predictive)
        try:
            posterior_pred = self.model.sample_posterior_predictive()
            if hasattr(posterior_pred, "posterior_predictive"):
                pp_data = posterior_pred.posterior_predictive
                y_var = list(pp_data.data_vars)[0]
                pp_vals = pp_data[y_var].values
                pp_flat = pp_vals.reshape(-1, pp_vals.shape[-1])
                hdi_lower = np.percentile(pp_flat, 3, axis=0).tolist()
                hdi_upper = np.percentile(pp_flat, 97, axis=0).tolist()
            else:
                hdi_lower = predicted.tolist()
                hdi_upper = predicted.tolist()
        except Exception:
            hdi_lower = predicted.tolist()
            hdi_upper = predicted.tolist()

        return DecompositionTS(
            dates=dates,
            actual=[float(v) for v in actual],
            predicted=[float(v) for v in predicted.tolist()],
            predicted_hdi_lower=[float(v) for v in hdi_lower[:len(dates)]],
            predicted_hdi_upper=[float(v) for v in hdi_upper[:len(dates)]],
            base=[float(v) for v in base_ts.tolist()],
            channels=channels_ts,
        )

    def generate_response_curves(self, n_points: int = 50) -> dict:
        """Generate response curve data for each channel.

        Returns dict keyed by channel name with:
            spend_levels: list[float]
            predicted_contribution: list[float]
            current_spend: float
            current_contribution: float
        """
        if self.model is None or self._prepared_data is None:
            return {}

        data = self._prepared_data
        curves = {}

        for i, ch in enumerate(self.model.channel_columns):
            spend = self._spend_data[ch] if self._spend_data else data.df[ch].values
            current_avg_spend = float(np.mean(spend))
            max_spend = float(np.max(spend)) * 2.0  # Go up to 2x max observed

            spend_levels = np.linspace(0, max_spend, n_points)

            # Use the model to predict contribution at each spend level
            contributions = []
            for s in spend_levels:
                try:
                    pred = self._predict_contribution_at_spend(ch, i, s)
                    contributions.append(pred)
                except Exception:
                    contributions.append(0.0)

            # Current operating point
            current_contribution = self._predict_contribution_at_spend(ch, i, current_avg_spend)

            curves[ch] = {
                "spend_levels": spend_levels.tolist(),
                "predicted_contribution": contributions,
                "current_spend": current_avg_spend,
                "current_contribution": current_contribution,
            }

        return curves

    def _predict_contribution_at_spend(self, channel: str, ch_idx: int, spend_level: float) -> float:
        """Predict mean contribution for a channel at a given spend level."""
        try:
            # Get mean channel contribution at current spend levels
            contributions = self.model.compute_channel_contribution_original_scale()
            mean_contribs = contributions[:, :, ch_idx].mean(axis=0).flatten()

            spend = self._spend_data[channel]
            current_mean_spend = float(np.mean(spend))

            if current_mean_spend > 0:
                # Scale linearly as rough approximation (true curve from saturation)
                current_mean_contrib = float(np.mean(mean_contribs))
                ratio = spend_level / current_mean_spend
                # Apply diminishing returns approximation
                return current_mean_contrib * (1 - np.exp(-ratio)) / (1 - np.exp(-1))
            return 0.0
        except Exception:
            return 0.0

    def generate_adstock_decay_curves(self, max_weeks: int = 12) -> dict:
        """Generate adstock decay curve data for each channel.

        Returns dict keyed by channel with:
            weeks: list[int]
            decay_weights: list[float]
        """
        adstock_type = self.config.get("adstock_type", "geometric")
        curves = {}

        for result in self._extract_adstock_params():
            weeks = list(range(max_weeks))
            if adstock_type == "geometric" and result.alpha is not None:
                weights = [result.alpha ** w for w in weeks]
            elif adstock_type == "weibull" and result.shape is not None and result.scale is not None:
                from scipy.stats import weibull_min
                weights = [
                    float(1 - weibull_min.cdf(w, result.shape, scale=result.scale))
                    for w in weeks
                ]
            else:
                weights = [1.0] + [0.0] * (max_weeks - 1)

            # Normalize so first week = 1.0
            max_w = max(weights) if weights else 1.0
            if max_w > 0:
                weights = [w / max_w for w in weights]

            curves[result.channel] = {
                "weeks": weeks,
                "decay_weights": weights,
            }

        return curves

    def serialize_model(self) -> bytes:
        buf = io.BytesIO()
        pickle.dump({
            "trace": self.trace,
            "config": self.config,
            "channel_columns": list(self.model.channel_columns) if self.model else [],
        }, buf)
        return buf.getvalue()

    def get_diagnostics(self) -> dict:
        diag = self._extract_diagnostics()
        return {
            "r_squared": diag.r_squared,
            "mape": diag.mape,
            "r_hat_max": diag.r_hat_max,
            "ess_min": diag.ess_min,
            "divergences": diag.divergences,
            "convergence_status": diag.convergence_status,
        }
