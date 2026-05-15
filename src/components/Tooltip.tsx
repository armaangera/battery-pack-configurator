import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTooltipsEnabled } from "../lib/tooltipsContext";

/**
 * Wraps a trigger element and shows a tooltip on hover/focus.
 *
 * The bubble is rendered through a portal into <body> and positioned
 * with JS based on the trigger's bounding rect + viewport size, so it
 * is never clipped by an `overflow:hidden` ancestor and never demands
 * horizontal scroll. Falls back to rendering children un-decorated
 * when the global "tips off" toggle is set.
 */
export function Tooltip({
  text,
  children,
  display = "inline-flex",
}: {
  text: string;
  children: ReactNode;
  /** How the wrapper span lays out — change to `"inline-block"` if
   * children rely on text-layout context. */
  display?: "inline-flex" | "inline-block" | "block";
}) {
  const enabled = useTooltipsEnabled();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    maxWidth: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const trigger = triggerRef.current;
      const bubble = bubbleRef.current;
      if (!trigger || !bubble) return;
      const tr = trigger.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gap = 8;
      const edge = 8;

      // Cap bubble width to viewport so we never demand horizontal scroll.
      const maxWidth = Math.min(280, vw - edge * 2);
      bubble.style.maxWidth = `${maxWidth}px`;
      const br = bubble.getBoundingClientRect();
      const bw = br.width;
      const bh = br.height;

      const spaceAbove = tr.top;
      const spaceBelow = vh - tr.bottom;
      const placeTop =
        spaceAbove >= bh + gap + edge || spaceAbove >= spaceBelow;
      const top = placeTop ? tr.top - bh - gap : tr.bottom + gap;

      // Horizontal: center on trigger, then clamp to viewport.
      let left = tr.left + tr.width / 2 - bw / 2;
      if (left < edge) left = edge;
      if (left + bw > vw - edge) left = vw - edge - bw;

      setPos({ top, left, maxWidth });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, text]);

  if (!enabled) return <>{children}</>;

  return (
    <>
      <span
        ref={triggerRef}
        style={{ display }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <div
            ref={bubbleRef}
            role="tooltip"
            className="info-tip-bubble"
            style={{
              position: "fixed",
              top: pos ? pos.top : -9999,
              left: pos ? pos.left : -9999,
              maxWidth: pos ? pos.maxWidth : 280,
              visibility: pos ? "visible" : "hidden",
            }}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}
