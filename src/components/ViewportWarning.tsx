import { useEffect, useState } from "react";

/**
 * Full-screen notice shown on narrow or portrait viewports. The
 * configurator's sidebar + multi-column results panel + four-chart grid
 * doesn't work below ~1024px wide, so we surface that up front instead
 * of letting the layout silently break.
 *
 * The user can dismiss it for the session; once dismissed it won't
 * reappear on subsequent resize events until the page is reloaded.
 */
export function ViewportWarning() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(
      "(min-width: 1024px) and (orientation: landscape)",
    );
    const update = () => setShow(!mq.matches);
    update();
    // Older Safari uses addListener; modern browsers use addEventListener.
    if (mq.addEventListener) {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  if (!show || dismissed) return null;

  return (
    <div className="viewport-warning" role="dialog" aria-modal="true">
      <div className="viewport-warning-card">
        <h2>Desktop recommended</h2>
        <p>
          This tool is designed for a landscape desktop display. On narrow
          or vertical screens the sidebar, results table, and charts overlap
          and become hard to use.
        </p>
        <p>
          For the best experience, rotate your device to landscape or open
          the page on a wider screen.
        </p>
        <div className="btn-row">
          <button className="btn" onClick={() => setDismissed(true)}>
            Continue anyway
          </button>
        </div>
      </div>
    </div>
  );
}
