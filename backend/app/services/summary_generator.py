"""Natural language summary generator for MMM results.

Accepts EngineResults dataclass and produces plain-English summaries
suitable for marketing managers and executives.
"""

from app.engine.types import EngineResults


def generate_summary(results: EngineResults) -> tuple[str, str]:
    """Generate a full summary and a top recommendation from EngineResults.

    Returns:
        (summary_text, top_recommendation)
    """
    contributions = results.channel_contributions
    roas_list = results.channel_roas
    saturation_list = results.saturation_params
    adstock_list = results.adstock_params

    if not contributions:
        return "No channel results available.", ""

    # Build lookup dicts
    roas_by_ch = {r.channel: r for r in roas_list}
    sat_by_ch = {s.channel: s for s in saturation_list}

    # Sort by contribution share descending
    ranked = sorted(contributions, key=lambda c: c.share_of_total, reverse=True)
    top = ranked[0]

    # Best ROAS channel
    best_roas = max(roas_list, key=lambda r: r.mean) if roas_list else None

    marketing_pct = 1 - results.base_sales_pct
    base_pct = results.base_sales_pct

    # ---- Build summary text ----
    lines = []
    lines.append("## Marketing Mix Analysis Summary\n")

    lines.append(
        f"**Your marketing drove {marketing_pct:.0%} of total revenue**, "
        f"with the remaining {base_pct:.0%} coming from baseline demand "
        f"(brand strength, organic traffic, seasonal patterns).\n"
    )

    top_roas = roas_by_ch.get(top.channel)
    if top_roas:
        lines.append(
            f"**{top.channel} is your most impactful channel**, contributing "
            f"{top.share_of_total:.0%} of marketing-driven revenue. "
            f"For every dollar spent on {top.channel}, you generated approximately "
            f"${top_roas.mean:.2f} in return "
            f"(94% confidence: ${top_roas.hdi_3:.2f} - ${top_roas.hdi_97:.2f}).\n"
        )
    else:
        lines.append(
            f"**{top.channel} is your most impactful channel**, contributing "
            f"{top.share_of_total:.0%} of marketing-driven revenue.\n"
        )

    if best_roas and best_roas.channel != top.channel:
        lines.append(
            f"**Highest ROI channel: {best_roas.channel}** with a return of "
            f"${best_roas.mean:.2f} per dollar spent.\n"
        )

    # Channel rankings
    lines.append("### Channel Rankings by Contribution:\n")
    for i, cc in enumerate(ranked, 1):
        roas = roas_by_ch.get(cc.channel)
        sat = sat_by_ch.get(cc.channel)
        roas_str = f"ROAS: ${roas.mean:.2f}" if roas else "ROAS: N/A"
        line = f"{i}. **{cc.channel}**: {cc.share_of_total:.0%} of marketing effect ({roas_str})"
        if sat and sat.saturation_pct > 0.8:
            line += " - Approaching saturation"
        lines.append(line)

    lines.append("")

    # Adstock interpretation
    lines.append("### Channel Effect Duration:\n")
    for a in adstock_list:
        if a.type == "geometric" and a.alpha is not None:
            retention_pct = a.alpha * 100
            lines.append(
                f"- **{a.channel}**: Effects last ~{a.mean_lag_weeks:.1f} weeks "
                f"({retention_pct:.0f}% weekly retention)"
            )
        elif a.type == "weibull":
            lines.append(
                f"- **{a.channel}**: Effects centered around {a.mean_lag_weeks:.1f} weeks"
            )
    lines.append("")

    # Recommendations
    lines.append("### Key Recommendations:\n")
    recs = _generate_recommendations(ranked, roas_by_ch, sat_by_ch)
    lines.append(recs)

    # Diagnostics note
    diag = results.diagnostics
    lines.append("\n### Model Quality:\n")
    quality_emoji = {"good": "Strong", "acceptable": "Acceptable", "poor": "Weak"}
    lines.append(
        f"- Convergence: {quality_emoji.get(diag.convergence_status, diag.convergence_status)}"
    )
    lines.append(f"- R-squared: {diag.r_squared:.2f}")
    if diag.mape > 0:
        lines.append(f"- Mean Absolute % Error: {diag.mape:.1f}%")
    if diag.divergences > 0:
        lines.append(
            f"- Warning: {diag.divergences} divergent transitions detected. "
            f"Consider running with more samples."
        )

    summary_text = "\n".join(lines)

    # ---- Top recommendation ----
    top_rec = _generate_top_recommendation(ranked, roas_by_ch, sat_by_ch)

    return summary_text, top_rec


def generate_channel_interpretation(results: EngineResults) -> dict[str, str]:
    """Generate per-channel interpretation text.

    Returns dict mapping channel name -> interpretation string.
    """
    roas_by_ch = {r.channel: r for r in results.channel_roas}
    sat_by_ch = {s.channel: s for s in results.saturation_params}
    adstock_by_ch = {a.channel: a for a in results.adstock_params}

    interpretations = {}

    for cc in results.channel_contributions:
        ch = cc.channel
        roas = roas_by_ch.get(ch)
        sat = sat_by_ch.get(ch)
        adstock = adstock_by_ch.get(ch)

        parts = []

        # Contribution statement
        parts.append(
            f"{ch} contributes {cc.share_of_total:.0%} of total marketing-driven revenue "
            f"(weekly mean: ${cc.mean:,.0f})."
        )

        # ROAS
        if roas:
            parts.append(
                f"Return on ad spend is ${roas.mean:.2f} per dollar "
                f"(94% CI: ${roas.hdi_3:.2f} - ${roas.hdi_97:.2f})."
            )

        # Adstock
        if adstock:
            if adstock.type == "geometric" and adstock.alpha:
                parts.append(
                    f"Advertising effects decay with {adstock.alpha*100:.0f}% weekly retention, "
                    f"meaning effects last approximately {adstock.mean_lag_weeks:.1f} weeks."
                )

        # Saturation
        if sat:
            if sat.saturation_pct > 0.85:
                parts.append(
                    f"This channel is at {sat.saturation_pct:.0%} saturation -- "
                    f"near its ceiling. Additional spend will yield diminishing returns."
                )
            elif sat.saturation_pct > 0.6:
                parts.append(
                    f"This channel is at {sat.saturation_pct:.0%} saturation -- "
                    f"moderate room for growth."
                )
            else:
                parts.append(
                    f"This channel is at {sat.saturation_pct:.0%} saturation -- "
                    f"significant room for increased spend."
                )

        # Recommendation
        rec = _channel_recommendation(ch, roas, sat)
        if rec:
            parts.append(f"Recommendation: {rec}")

        interpretations[ch] = " ".join(parts)

    return interpretations


def _generate_recommendations(
    ranked: list, roas_by_ch: dict, sat_by_ch: dict
) -> str:
    recs = []

    for cc in ranked:
        ch = cc.channel
        sat = sat_by_ch.get(ch)
        roas = roas_by_ch.get(ch)

        sat_pct = sat.saturation_pct if sat else 0.0
        roas_val = roas.mean if roas else 0.0

        if sat_pct > 0.85:
            recs.append(
                f"- **Reduce {ch}** spend -- channel is {sat_pct:.0%} saturated. "
                f"Reallocate to higher-marginal-return channels."
            )
        elif roas_val > 3 and sat_pct < 0.6:
            recs.append(
                f"- **Increase {ch}** spend -- strong ROAS (${roas_val:.2f}) with room to grow "
                f"({sat_pct:.0%} saturation)."
            )
        elif roas_val < 1 and roas_val > 0:
            recs.append(
                f"- **Reconsider {ch}** -- ROAS below 1.0 (${roas_val:.2f}). "
                f"Consider reducing or reallocating budget."
            )

    if not recs:
        recs.append("- Current allocation appears balanced. Monitor trends over time.")

    return "\n".join(recs)


def _generate_top_recommendation(
    ranked: list, roas_by_ch: dict, sat_by_ch: dict
) -> str:
    """Generate the single most important recommendation."""
    # Find the most saturated channel
    most_saturated = None
    most_sat_pct = 0.0

    # Find the best opportunity channel (high ROAS + low saturation)
    best_opportunity = None
    best_score = 0.0

    for cc in ranked:
        ch = cc.channel
        sat = sat_by_ch.get(ch)
        roas = roas_by_ch.get(ch)

        sat_pct = sat.saturation_pct if sat else 0.0
        roas_val = roas.mean if roas else 0.0

        if sat_pct > most_sat_pct:
            most_sat_pct = sat_pct
            most_saturated = ch

        # Score = ROAS * (1 - saturation) -- higher is better opportunity
        score = roas_val * (1 - sat_pct)
        if score > best_score:
            best_score = score
            best_opportunity = ch

    if most_saturated and best_opportunity and most_saturated != best_opportunity and most_sat_pct > 0.7:
        return (
            f"Shift budget from {most_saturated} (saturated at {most_sat_pct:.0%}) "
            f"to {best_opportunity} for higher marginal returns."
        )
    elif best_opportunity:
        roas = roas_by_ch.get(best_opportunity)
        roas_str = f"${roas.mean:.2f}" if roas else "strong"
        return f"Increase {best_opportunity} investment -- best opportunity with {roas_str} ROAS and room to grow."
    else:
        return "Current budget allocation appears well-balanced."


def _channel_recommendation(ch: str, roas, sat) -> str:
    """Generate a single recommendation for a channel."""
    sat_pct = sat.saturation_pct if sat else 0.0
    roas_val = roas.mean if roas else 0.0

    if sat_pct > 0.85:
        return "Reduce spend. Channel is near saturation ceiling."
    elif roas_val > 3 and sat_pct < 0.6:
        return "Increase spend. Strong returns with room to grow."
    elif roas_val < 1 and roas_val > 0:
        return "Consider reducing or reallocating budget. ROAS below break-even."
    elif roas_val >= 1 and sat_pct < 0.7:
        return "Maintain current spend. Healthy returns with growth headroom."
    elif roas_val >= 1:
        return "Maintain current spend. Returns are positive but approaching saturation."
    return ""


# Backward-compatible wrapper for dict-based input (used by older code paths)
def generate_executive_summary(results: dict, mapping: dict) -> str:
    """Generate plain-English MMM summary from structured results dict.

    This is the legacy interface. Prefer generate_summary(EngineResults) for new code.
    """
    channel_results = results.get("channel_results", [])
    base_sales = results.get("base_sales", {})

    if not channel_results:
        return "No channel results available."

    ranked = sorted(channel_results, key=lambda x: x.get("contribution_share", 0), reverse=True)
    top = ranked[0]

    best_roas = max(channel_results, key=lambda x: x.get("roas", {}).get("mean", 0))

    marketing_pct = 1 - base_sales.get("share_of_total", 0.35)
    base_pct = base_sales.get("share_of_total", 0.35)

    summary = f"""## Marketing Mix Analysis Summary

**Your marketing drove {marketing_pct:.0%} of total revenue**, with the remaining {base_pct:.0%} coming from baseline demand (brand strength, organic traffic, seasonal patterns).

**{top['channel']} is your most impactful channel**, contributing {top['contribution_share']:.0%} of marketing-driven revenue. For every dollar spent on {top['channel']}, you generated approximately ${top['roas']['mean']:.2f} in return (94% confidence: ${top['roas']['hdi_3']:.2f} - ${top['roas']['hdi_97']:.2f}).

**Highest ROI channel: {best_roas['channel']}** with a return of ${best_roas['roas']['mean']:.2f} per dollar spent.

### Channel Rankings by Contribution:
"""

    for i, ch in enumerate(ranked, 1):
        roas_val = ch.get("roas", {}).get("mean", 0)
        sat_pct = ch.get("saturation_pct", 0)
        summary += f"{i}. **{ch['channel']}**: {ch['contribution_share']:.0%} of marketing effect (ROAS: ${roas_val:.2f})"
        if sat_pct > 0.8:
            summary += " - Approaching saturation"
        summary += "\n"

    summary += "\n### Key Recommendations:\n"
    summary += _generate_recommendations_legacy(ranked)

    return summary


def _generate_recommendations_legacy(ranked: list) -> str:
    recs = []
    for ch in ranked:
        sat = ch.get("saturation_pct", 0)
        roas = ch.get("roas", {}).get("mean", 0)

        if sat > 0.85:
            recs.append(
                f"- **Reduce {ch['channel']}** spend -- channel is {sat:.0%} saturated. "
                f"Reallocate to higher-marginal-return channels."
            )
        elif roas > 3 and sat < 0.6:
            recs.append(
                f"- **Increase {ch['channel']}** spend -- strong ROAS (${roas:.2f}) with room to grow "
                f"({sat:.0%} saturation)."
            )
        elif roas < 1:
            recs.append(
                f"- **Reconsider {ch['channel']}** -- ROAS below 1.0 (${roas:.2f}). "
                f"Consider reducing or reallocating budget."
            )

    if not recs:
        recs.append("- Current allocation appears balanced. Monitor trends over time.")

    return "\n".join(recs)
