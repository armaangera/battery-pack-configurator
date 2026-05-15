import { memo } from "react";
import type {
  ArchitectureKeyPicks,
  ConfigResult,
  PickEntry,
} from "../lib/modelTypes";
import { fmtMoney, fmtNum, fmtPct, labelForReason } from "../lib/formatting";
import { InfoTip } from "./InfoTip";

/** Concise descriptions of what each "best of architecture" pick label means. */
const PICK_TIPS: Record<string, string> = {
  Lightest: "Feasible config with the lowest total pack mass (cells × overhead) for this architecture.",
  Cheapest: "Feasible config with the lowest total pack BOM cost for this architecture.",
  "Least oversized":
    "Feasible config whose energy margin is closest to the Min energy margin — the tightest fit with the least wasted capacity.",
  "Most efficient":
    "Feasible config with the highest system efficiency (useful load divided by useful load + IR loss + converter loss) at the mission average load.",
};

function tipForPickLabel(label: string): string | undefined {
  return PICK_TIPS[label];
}

interface Props {
  keyPicksByArchitecture: Record<string, ArchitectureKeyPicks>;
  colorFor: (arch: string) => string;
}

function PickCard({ pick }: { pick: PickEntry }) {
  const c = pick.config;
  const tip = tipForPickLabel(pick.label);
  return (
    <div className="pick-card">
      <div className="pick-label" style={{ display: "inline-flex", alignItems: "center" }}>
        {pick.label}
        {tip && <InfoTip text={tip} />}
      </div>
      <div className="pick-config">{c.cell} · {c.S}S{c.P}P</div>
      <div className="pick-metrics">
        <span>{fmtNum(c.pack_mass_kg, 2)} kg</span>
        <span>{fmtMoney(c.pack_cost_usd)}</span>
        <span>{fmtNum(c.runtime_min, 1)} min</span>
        <span>{fmtPct(c.system_eff_avg, 1)}</span>
      </div>
      <div className="pick-metrics">
        <span className="muted">E margin {fmtNum(c.energy_margin, 2)}×</span>
        <span className="muted">I margin {fmtNum(c.current_margin, 2)}×</span>
      </div>
    </div>
  );
}

function ClosestRejected({
  configs,
}: {
  configs: ConfigResult[];
}) {
  return (
    <div className="picks-row">
      {configs.map((c) => (
        <div key={`${c.cell}-${c.S}-${c.P}`} className="pick-card">
          <div
            className="pick-label"
            style={{ color: "var(--danger)", display: "inline-flex", alignItems: "center" }}
          >
            Closest rejected
            <InfoTip text="No feasible config exists for this architecture; this is the rejected config nearest to passing (fewest failed reasons, best margins)." />
          </div>
          <div className="pick-config">{c.cell} · {c.S}S{c.P}P</div>
          <div className="pick-metrics">
            <span>{fmtNum(c.pack_mass_kg, 2)} kg</span>
            <span>{fmtMoney(c.pack_cost_usd)}</span>
            <span>{fmtNum(c.runtime_min, 1)} min</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 11 }}>
            {c.reasons.map((r) => (
              <span key={r} className="badge">{labelForReason(r)}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ArchitecturePicksImpl({ keyPicksByArchitecture, colorFor }: Props) {
  const archNames = Object.keys(keyPicksByArchitecture);
  if (archNames.length === 0) return null;

  return (
    <div className="arch-picks">
      {archNames.map((name) => {
        const block = keyPicksByArchitecture[name];
        return (
          <div
            key={name}
            className="arch-pick-group"
            style={{ ["--arch-color" as string]: colorFor(name) }}
          >
            <div className="arch-pick-head">
              <span className="arch-pick-name">{name}</span>
              {!block.has_feasible && (
                <span className="muted" style={{ fontSize: 11 }}>
                  no feasible configurations
                </span>
              )}
            </div>
            {block.has_feasible ? (
              <div className="picks-row">
                {block.picks.map((pick) => (
                  <PickCard key={pick.label} pick={pick} />
                ))}
              </div>
            ) : block.closest_rejected.length > 0 ? (
              <ClosestRejected configs={block.closest_rejected.slice(0, 4)} />
            ) : (
              <div className="empty-state" style={{ padding: 12 }}>
                No configurations evaluated for this architecture.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const ArchitecturePicks = memo(ArchitecturePicksImpl);
