"""Generate synthetic marketing data with known parameters for testing.

The ground truth parameters allow us to verify the MMM engine
recovers them within acceptable bounds.
"""

import numpy as np
import pandas as pd


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

    # Date range
    dates = pd.date_range(start="2022-01-03", periods=n_weeks, freq="W-MON")

    # Channel names and their true parameters
    channels = {
        "tv_spend": {"beta": 0.25, "alpha": 0.7, "lam": 0.5},
        "meta_spend": {"beta": 0.15, "alpha": 0.3, "lam": 0.8},
        "search_spend": {"beta": 0.20, "alpha": 0.1, "lam": 0.4},
        "radio_spend": {"beta": 0.08, "alpha": 0.5, "lam": 0.6},
    }

    # Limit to requested number of channels
    channel_names = list(channels.keys())[:n_channels]

    # Generate spend data (log-normal distribution)
    spend_data = {}
    for ch in channel_names:
        base_spend = rng.lognormal(mean=10, sigma=0.5, size=n_weeks)
        # Add some seasonality
        seasonal = 1 + 0.2 * np.sin(2 * np.pi * np.arange(n_weeks) / 52)
        spend_data[ch] = base_spend * seasonal

    # Control variables
    temperature = 15 + 10 * np.sin(2 * np.pi * np.arange(n_weeks) / 52) + rng.normal(0, 2, n_weeks)
    holiday_flag = np.zeros(n_weeks)
    holiday_weeks = [0, 13, 26, 39, 48, 49, 50, 51]  # Quarterly + year-end
    for w in holiday_weeks:
        if w < n_weeks:
            holiday_flag[w] = 1

    # Generate target (revenue)
    base_revenue = 50000  # Baseline sales
    noise = rng.normal(0, 2000, n_weeks)

    revenue = np.full(n_weeks, base_revenue, dtype=float)

    # Add channel contributions with geometric adstock and logistic saturation
    for ch in channel_names:
        params = channels[ch]
        spend = spend_data[ch]

        # Apply geometric adstock
        adstocked = np.zeros(n_weeks)
        adstocked[0] = spend[0]
        for t in range(1, n_weeks):
            adstocked[t] = spend[t] + params["alpha"] * adstocked[t - 1]

        # Apply logistic saturation
        saturated = 1 / (1 + np.exp(-params["lam"] * (adstocked / adstocked.mean() - 1)))

        # Scale contribution
        contribution = params["beta"] * base_revenue * saturated
        revenue += contribution

    # Add control effects
    revenue += 100 * temperature  # Temperature effect
    revenue += 5000 * holiday_flag  # Holiday boost
    revenue += noise

    # Assemble DataFrame
    df = pd.DataFrame({"week_start": dates, "revenue": revenue})
    for ch in channel_names:
        df[ch] = spend_data[ch]
    df["temperature"] = temperature
    df["holiday_flag"] = holiday_flag

    ground_truth = {
        "base_revenue": base_revenue,
        "channels": {ch: channels[ch] for ch in channel_names},
        "n_weeks": n_weeks,
    }

    return df, ground_truth


if __name__ == "__main__":
    df, truth = generate_synthetic_dataset()
    df.to_csv("tests/fixtures/synthetic_104w.csv", index=False)
    print(f"Generated {len(df)} rows, {len(truth['channels'])} channels")
    print(f"Ground truth: {truth}")
