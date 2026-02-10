"""Generate synthetic marketing data with known parameters for testing.

The ground truth parameters allow us to verify the MMM engine
recovers them within acceptable bounds.
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path


# Ground truth parameters for all scenarios
GROUND_TRUTH_104W = {
    "base_revenue": 50000,
    "n_weeks": 104,
    "channels": {
        "tv_spend": {"beta": 0.25, "alpha": 0.70, "lam": 0.50},
        "meta_spend": {"beta": 0.15, "alpha": 0.30, "lam": 0.80},
        "search_spend": {"beta": 0.20, "alpha": 0.10, "lam": 0.40},
        "radio_spend": {"beta": 0.08, "alpha": 0.50, "lam": 0.60},
    },
    "controls": {
        "temperature_coeff": 100,
        "holiday_boost": 5000,
    },
}

GROUND_TRUTH_52W = {
    "base_revenue": 50000,
    "n_weeks": 52,
    "channels": {
        "tv_spend": {"beta": 0.25, "alpha": 0.70, "lam": 0.50},
        "meta_spend": {"beta": 0.15, "alpha": 0.30, "lam": 0.80},
        "search_spend": {"beta": 0.20, "alpha": 0.10, "lam": 0.40},
        "radio_spend": {"beta": 0.08, "alpha": 0.50, "lam": 0.60},
    },
    "controls": {
        "temperature_coeff": 100,
        "holiday_boost": 5000,
    },
}


def _apply_geometric_adstock(spend: np.ndarray, alpha: float) -> np.ndarray:
    """Apply geometric adstock transformation."""
    n = len(spend)
    adstocked = np.zeros(n)
    adstocked[0] = spend[0]
    for t in range(1, n):
        adstocked[t] = spend[t] + alpha * adstocked[t - 1]
    return adstocked


def _apply_logistic_saturation(x: np.ndarray, lam: float) -> np.ndarray:
    """Apply logistic saturation: 1 / (1 + exp(-lam * (x/mean - 1)))."""
    x_mean = x.mean()
    if x_mean == 0:
        return np.zeros_like(x)
    return 1.0 / (1.0 + np.exp(-lam * (x / x_mean - 1.0)))


def generate_synthetic_dataset(
    n_weeks: int = 104,
    n_channels: int = 4,
    seed: int = 42,
) -> tuple[pd.DataFrame, dict]:
    """Generate synthetic weekly marketing data with known parameters.

    Returns:
        (df, ground_truth) where ground_truth contains the true parameter values
        that the MMM should recover.
    """
    rng = np.random.default_rng(seed)

    dates = pd.date_range(start="2022-01-03", periods=n_weeks, freq="W-MON")

    channels = {
        "tv_spend": {"beta": 0.25, "alpha": 0.7, "lam": 0.5},
        "meta_spend": {"beta": 0.15, "alpha": 0.3, "lam": 0.8},
        "search_spend": {"beta": 0.20, "alpha": 0.1, "lam": 0.4},
        "radio_spend": {"beta": 0.08, "alpha": 0.5, "lam": 0.6},
    }

    channel_names = list(channels.keys())[:n_channels]

    # Generate spend data with log-normal distribution + seasonality
    spend_data = {}
    for ch in channel_names:
        base_spend = rng.lognormal(mean=10, sigma=0.5, size=n_weeks)
        seasonal = 1 + 0.2 * np.sin(2 * np.pi * np.arange(n_weeks) / 52)
        spend_data[ch] = base_spend * seasonal

    # Control variables
    temperature = (
        15
        + 10 * np.sin(2 * np.pi * np.arange(n_weeks) / 52)
        + rng.normal(0, 2, n_weeks)
    )
    holiday_flag = np.zeros(n_weeks)
    holiday_weeks = [0, 13, 26, 39, 48, 49, 50, 51]
    for w in holiday_weeks:
        if w < n_weeks:
            holiday_flag[w] = 1
    # Repeat holidays for second year if 104 weeks
    if n_weeks > 52:
        for w in holiday_weeks:
            week_idx = w + 52
            if week_idx < n_weeks:
                holiday_flag[week_idx] = 1

    # Base revenue
    base_revenue = 50000
    noise = rng.normal(0, 2000, n_weeks)

    revenue = np.full(n_weeks, base_revenue, dtype=float)

    # Track per-channel contributions for ground truth
    channel_contributions = {}

    for ch in channel_names:
        params = channels[ch]
        spend = spend_data[ch]

        adstocked = _apply_geometric_adstock(spend, params["alpha"])
        saturated = _apply_logistic_saturation(adstocked, params["lam"])
        contribution = params["beta"] * base_revenue * saturated

        channel_contributions[ch] = contribution
        revenue += contribution

    # Control effects
    revenue += 100 * temperature
    revenue += 5000 * holiday_flag
    revenue += noise

    # Assemble DataFrame
    df = pd.DataFrame({"week_start": dates, "revenue": revenue})
    for ch in channel_names:
        df[ch] = spend_data[ch]
    df["temperature"] = temperature
    df["holiday_flag"] = holiday_flag

    # Compute ground truth summaries
    total_revenue = revenue.sum()
    total_channel_contribution = sum(c.sum() for c in channel_contributions.values())
    base_total = base_revenue * n_weeks

    ground_truth = {
        "base_revenue": base_revenue,
        "base_sales_pct": base_total / total_revenue,
        "channels": {},
        "controls": {
            "temperature_coeff": 100,
            "holiday_boost": 5000,
        },
        "n_weeks": n_weeks,
        "total_revenue": float(total_revenue),
        "total_media_contribution": float(total_channel_contribution),
    }

    for ch in channel_names:
        params = channels[ch]
        ch_total = channel_contributions[ch].sum()
        total_spend = spend_data[ch].sum()
        ground_truth["channels"][ch] = {
            "beta": params["beta"],
            "alpha": params["alpha"],
            "lam": params["lam"],
            "total_contribution": float(ch_total),
            "contribution_share": float(ch_total / total_channel_contribution),
            "roas": float(ch_total / total_spend) if total_spend > 0 else 0.0,
            "total_spend": float(total_spend),
        }

    return df, ground_truth


def generate_high_saturation_dataset(
    n_weeks: int = 104, seed: int = 123
) -> tuple[pd.DataFrame, dict]:
    """Scenario: channels near saturation ceiling (high spend, diminishing returns)."""
    rng = np.random.default_rng(seed)
    dates = pd.date_range(start="2022-01-03", periods=n_weeks, freq="W-MON")

    channels = {
        "tv_spend": {"beta": 0.25, "alpha": 0.7, "lam": 0.3},
        "meta_spend": {"beta": 0.15, "alpha": 0.3, "lam": 0.4},
        "search_spend": {"beta": 0.20, "alpha": 0.1, "lam": 0.3},
    }

    spend_data = {}
    for ch in channels:
        # Much higher spend levels to push into saturation
        base_spend = rng.lognormal(mean=12, sigma=0.3, size=n_weeks)
        spend_data[ch] = base_spend

    base_revenue = 80000
    revenue = np.full(n_weeks, base_revenue, dtype=float)
    noise = rng.normal(0, 2500, n_weeks)

    for ch, params in channels.items():
        spend = spend_data[ch]
        adstocked = _apply_geometric_adstock(spend, params["alpha"])
        saturated = _apply_logistic_saturation(adstocked, params["lam"])
        revenue += params["beta"] * base_revenue * saturated

    revenue += noise

    df = pd.DataFrame({"week_start": dates, "revenue": revenue})
    for ch in channels:
        df[ch] = spend_data[ch]

    ground_truth = {
        "base_revenue": base_revenue,
        "channels": channels,
        "n_weeks": n_weeks,
        "scenario": "high_saturation",
    }
    return df, ground_truth


def generate_low_data_dataset(seed: int = 456) -> tuple[pd.DataFrame, dict]:
    """Scenario: only 52 weeks, 2 channels -- minimal viable data."""
    return generate_synthetic_dataset(n_weeks=52, n_channels=2, seed=seed)


def generate_complex_dataset(
    n_weeks: int = 104, seed: int = 789
) -> tuple[pd.DataFrame, dict]:
    """Scenario: 6 channels, multiple controls, strong seasonality."""
    rng = np.random.default_rng(seed)
    dates = pd.date_range(start="2022-01-03", periods=n_weeks, freq="W-MON")

    channels = {
        "tv_spend": {"beta": 0.22, "alpha": 0.70, "lam": 0.5},
        "meta_spend": {"beta": 0.14, "alpha": 0.30, "lam": 0.7},
        "search_spend": {"beta": 0.18, "alpha": 0.10, "lam": 0.4},
        "radio_spend": {"beta": 0.06, "alpha": 0.50, "lam": 0.6},
        "display_spend": {"beta": 0.10, "alpha": 0.40, "lam": 0.5},
        "email_spend": {"beta": 0.04, "alpha": 0.05, "lam": 0.9},
    }

    spend_data = {}
    for ch in channels:
        base_spend = rng.lognormal(mean=10, sigma=0.5, size=n_weeks)
        seasonal = 1 + 0.3 * np.sin(2 * np.pi * np.arange(n_weeks) / 52)
        spend_data[ch] = base_spend * seasonal

    # Multiple controls
    temperature = (
        15 + 12 * np.sin(2 * np.pi * np.arange(n_weeks) / 52)
        + rng.normal(0, 2, n_weeks)
    )
    holiday_flag = np.zeros(n_weeks)
    for w in [0, 13, 26, 39, 48, 49, 50, 51]:
        if w < n_weeks:
            holiday_flag[w] = 1
        if w + 52 < n_weeks:
            holiday_flag[w + 52] = 1
    competitor_promo = rng.binomial(1, 0.15, n_weeks).astype(float)

    base_revenue = 60000
    revenue = np.full(n_weeks, base_revenue, dtype=float)
    noise = rng.normal(0, 3000, n_weeks)

    for ch, params in channels.items():
        spend = spend_data[ch]
        adstocked = _apply_geometric_adstock(spend, params["alpha"])
        saturated = _apply_logistic_saturation(adstocked, params["lam"])
        revenue += params["beta"] * base_revenue * saturated

    revenue += 120 * temperature
    revenue += 7000 * holiday_flag
    revenue -= 3000 * competitor_promo
    revenue += noise

    df = pd.DataFrame({"week_start": dates, "revenue": revenue})
    for ch in channels:
        df[ch] = spend_data[ch]
    df["temperature"] = temperature
    df["holiday_flag"] = holiday_flag
    df["competitor_promo"] = competitor_promo

    ground_truth = {
        "base_revenue": base_revenue,
        "channels": channels,
        "n_weeks": n_weeks,
        "scenario": "complex",
    }
    return df, ground_truth


if __name__ == "__main__":
    fixtures_dir = Path(__file__).parent

    # 104-week standard dataset
    df_104, truth_104 = generate_synthetic_dataset(n_weeks=104)
    df_104.to_csv(fixtures_dir / "synthetic_104w.csv", index=False)
    with open(fixtures_dir / "ground_truth_104w.json", "w") as f:
        json.dump(truth_104, f, indent=2)
    print(f"Generated synthetic_104w.csv: {len(df_104)} rows, {len(truth_104['channels'])} channels")

    # 52-week quick-test dataset
    df_52, truth_52 = generate_synthetic_dataset(n_weeks=52)
    df_52.to_csv(fixtures_dir / "synthetic_52w.csv", index=False)
    with open(fixtures_dir / "ground_truth_52w.json", "w") as f:
        json.dump(truth_52, f, indent=2)
    print(f"Generated synthetic_52w.csv: {len(df_52)} rows, {len(truth_52['channels'])} channels")

    # Validation scenario datasets
    df_hs, _ = generate_high_saturation_dataset()
    df_hs.to_csv(fixtures_dir / "synthetic_high_saturation.csv", index=False)
    print(f"Generated synthetic_high_saturation.csv: {len(df_hs)} rows")

    df_ld, _ = generate_low_data_dataset()
    df_ld.to_csv(fixtures_dir / "synthetic_low_data.csv", index=False)
    print(f"Generated synthetic_low_data.csv: {len(df_ld)} rows")

    df_cx, _ = generate_complex_dataset()
    df_cx.to_csv(fixtures_dir / "synthetic_complex.csv", index=False)
    print(f"Generated synthetic_complex.csv: {len(df_cx)} rows")

    print("\nGround truth (104w):")
    for ch, params in truth_104["channels"].items():
        print(f"  {ch}: ROAS={params['roas']:.2f}, alpha={params['alpha']}, lam={params['lam']}, share={params['contribution_share']:.1%}")
    print(f"  Base sales %: {truth_104['base_sales_pct']:.1%}")
