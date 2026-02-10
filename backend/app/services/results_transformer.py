"""Transform EngineResults into the frontend-expected ModelResults format."""

from app.engine.types import EngineResults
from app.services.summary_generator import generate_summary, generate_channel_interpretation


def transform_results(engine_results: EngineResults) -> dict:
    """Transform flat EngineResults into unified ModelResults dict for frontend.

    Merges channel_contributions, channel_roas, adstock_params, and saturation_params
    into a unified channel_results array. Also calls the summary generator.
    """
    # Generate summaries
    summary_text, top_recommendation = generate_summary(engine_results)
    channel_recommendations = generate_channel_interpretation(engine_results)

    # Build lookup dicts by channel name
    roas_by_ch = {r.channel: r for r in engine_results.channel_roas}
    adstock_by_ch = {a.channel: a for a in engine_results.adstock_params}
    sat_by_ch = {s.channel: s for s in engine_results.saturation_params}

    # Merge into unified channel_results
    channel_results = []
    for cc in engine_results.channel_contributions:
        ch = cc.channel
        roas = roas_by_ch.get(ch)
        adstock = adstock_by_ch.get(ch)
        sat = sat_by_ch.get(ch)

        channel_result = {
            "channel": ch,
            "contribution_share": cc.share_of_total,
            "weekly_contribution_mean": cc.mean,
            "roas": {
                "mean": roas.mean if roas else 0.0,
                "median": roas.median if roas else 0.0,
                "hdi_3": roas.hdi_3 if roas else 0.0,
                "hdi_97": roas.hdi_97 if roas else 0.0,
            },
            "adstock_params": {
                "type": adstock.type if adstock else "geometric",
                "alpha": adstock.alpha if adstock else None,
                "shape": adstock.shape if adstock else None,
                "scale": adstock.scale if adstock else None,
                "mean_lag_weeks": adstock.mean_lag_weeks if adstock else 0.0,
            },
            "saturation_params": {
                "type": sat.type if sat else "logistic",
                "lam": sat.lam if sat else None,
                "k": sat.k if sat else None,
                "s": sat.s if sat else None,
            },
            "saturation_pct": sat.saturation_pct if sat else 0.0,
            "recommendation": channel_recommendations.get(ch, ""),
        }
        channel_results.append(channel_result)

    # Build diagnostics
    diag = engine_results.diagnostics
    diagnostics = {
        "r_squared": diag.r_squared,
        "mape": diag.mape,
        "r_hat_max": diag.r_hat_max,
        "ess_min": diag.ess_min,
        "divergences": diag.divergences,
        "convergence_status": diag.convergence_status,
    }

    # Build base_sales
    base_sales = {
        "weekly_mean": engine_results.base_sales_weekly_mean,
        "share_of_total": engine_results.base_sales_pct,
    }

    # Build decomposition_ts
    ts = engine_results.decomposition_ts
    decomposition_ts = {
        "dates": ts.dates,
        "actual": ts.actual,
        "predicted": ts.predicted,
        "predicted_hdi_lower": ts.predicted_hdi_lower,
        "predicted_hdi_upper": ts.predicted_hdi_upper,
        "base": ts.base,
        "channels": ts.channels,
    }

    return {
        "diagnostics": diagnostics,
        "base_sales": base_sales,
        "channel_results": channel_results,
        "decomposition_ts": decomposition_ts,
        "summary_text": summary_text,
        "top_recommendation": top_recommendation,
        "response_curves": engine_results.response_curves if isinstance(engine_results.response_curves, dict) else {},
        "adstock_decay_curves": getattr(engine_results, 'adstock_decay_curves', {}),
    }
