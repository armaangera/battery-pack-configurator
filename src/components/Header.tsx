import { InformationCircleIcon } from "@heroicons/react/24/outline";
import type { ModelStatus } from "../lib/modelTypes";

const STATUS_LABEL: Record<ModelStatus, string> = {
  loading: "Loading Python…",
  ready: "Ready",
  running: "Running…",
  error: "Error",
};

export function StatusPill({ status }: { status: ModelStatus }) {
  return <span className={`status-pill ${status}`}>{STATUS_LABEL[status]}</span>;
}

function TooltipsToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`tooltips-toggle ${enabled ? "on" : ""}`}
      onClick={onToggle}
      aria-pressed={enabled}
      title={
        enabled
          ? "Hide info tooltips on labels"
          : "Show info tooltips on labels"
      }
    >
      <InformationCircleIcon className="info-tip-icon" aria-hidden />
      <span>{enabled ? "Tips on" : "Tips off"}</span>
    </button>
  );
}

export function Header({
  status,
  tooltipsEnabled,
  onToggleTooltips,
}: {
  status: ModelStatus;
  tooltipsEnabled: boolean;
  onToggleTooltips: () => void;
}) {
  return (
    <header className="app-header">
      <div>
        <h1>Battery Pack Configurator</h1>
        <div className="subtitle">
          Compare pack architectures and cell configurations under your mission constraints.
        </div>
      </div>
      <div className="header-right">
        <TooltipsToggle enabled={tooltipsEnabled} onToggle={onToggleTooltips} />
        <StatusPill status={status} />
      </div>
    </header>
  );
}
