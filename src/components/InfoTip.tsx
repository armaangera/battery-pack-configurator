import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { useTooltipsEnabled } from "../lib/tooltipsContext";
import { Tooltip } from "./Tooltip";

/**
 * Small info icon next to a label that reveals a descriptive tooltip
 * on hover/focus. Returns nothing when the global "tips off" toggle
 * is set so callers can sprinkle it freely.
 */
export function InfoTip({ text }: { text: string }) {
  const enabled = useTooltipsEnabled();
  if (!enabled) return null;
  return (
    <Tooltip text={text}>
      <span
        className="info-tip"
        tabIndex={0}
        aria-label={text}
        onClick={(e) => e.stopPropagation()}
      >
        <InformationCircleIcon className="info-tip-icon" aria-hidden />
      </span>
    </Tooltip>
  );
}
