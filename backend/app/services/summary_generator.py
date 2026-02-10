"""Natural language summary generator for MMM results."""


def generate_executive_summary(results: dict, mapping: dict) -> str:
    """Generate plain-English MMM summary from structured results."""
    channel_results = results.get("channel_results", [])
    base_sales = results.get("base_sales", {})
    diagnostics = results.get("diagnostics", {})

    if not channel_results:
        return "No channel results available."

    # Sort by contribution share
    ranked = sorted(channel_results, key=lambda x: x.get("contribution_share", 0), reverse=True)
    top = ranked[0]

    # Find best ROAS
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
    summary += _generate_recommendations(ranked)

    return summary


def _generate_recommendations(ranked: list) -> str:
    recs = []

    for ch in ranked:
        sat = ch.get("saturation_pct", 0)
        roas = ch.get("roas", {}).get("mean", 0)

        if sat > 0.85:
            recs.append(
                f"- **Reduce {ch['channel']}** spend — channel is {sat:.0%} saturated. "
                f"Reallocate to higher-marginal-return channels."
            )
        elif roas > 3 and sat < 0.6:
            recs.append(
                f"- **Increase {ch['channel']}** spend — strong ROAS (${roas:.2f}) with room to grow "
                f"({sat:.0%} saturation)."
            )
        elif roas < 1:
            recs.append(
                f"- **Reconsider {ch['channel']}** — ROAS below 1.0 (${roas:.2f}). "
                f"Consider reducing or reallocating budget."
            )

    if not recs:
        recs.append("- Current allocation appears balanced. Monitor trends over time.")

    return "\n".join(recs)
