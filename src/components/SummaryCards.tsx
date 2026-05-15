import { memo } from "react";
import type { ModelResult } from "../lib/modelTypes";
import { InfoTip } from "./InfoTip";

function Card({
  label,
  value,
  sub,
  tip,
}: {
  label: string;
  value: string;
  sub?: string;
  tip?: string;
}) {
  return (
    <div className="summary-card">
      <div className="label" style={{ display: "inline-flex", alignItems: "center" }}>
        {label}
        {tip && <InfoTip text={tip} />}
      </div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

/**
 * Neutral run summary — does NOT pick a winner. Use GlobalPicks for labels.
 */
function SummaryCardsImpl({ result }: { result: ModelResult }) {
  const { summary } = result;
  return (
    <div className="summary-grid">
      <Card
        label="Feasible"
        value={String(summary.feasible_count)}
        tip="Number of (cell, architecture, S, P) combinations that passed every constraint in the current run."
      />
      <Card
        label="Rejected"
        value={String(summary.rejected_count)}
        tip="Combinations that failed one or more constraints (voltage, current, energy, mass, cost, or converter range)."
      />
      <Card
        label="Total avg load"
        value={`${summary.total_avg_load_w.toFixed(0)} W`}
        tip="Sum of cooling avg + other avg from the Loads section. Sets the energy budget over the mission."
      />
      <Card
        label="Total peak load"
        value={`${summary.total_peak_load_w.toFixed(0)} W`}
        tip="Sum of cooling peak + other peak. Sets the worst-case current the pack must support."
      />
    </div>
  );
}

export const SummaryCards = memo(SummaryCardsImpl);
