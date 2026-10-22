import { useEffect, useState } from "react";

const EXIT_MS = 220;

/**
 * Keeps children mounted long enough to play an exit animation.
 *   <Presence show={open} anim="slide-up"> ... </Presence>
 * `anim`: "fade" | "slide-up" | "slide-right" (see index.css).
 * The wrapper is a viewport-sized fixed layer (so `fixed` children keep working while
 * the wrapper's transform animates). Pass a z-index class, e.g. className="z-30".
 */
export default function Presence({ show, anim = "fade", className = "", children }) {
  const [mounted, setMounted] = useState(show);
  const [last, setLast] = useState(children);

  // Remember the last rendered children so they stay visible while exiting
  // (callers often unmount their data at the same moment `show` flips false).
  if (show && last !== children) setLast(children);

  if (show && !mounted) setMounted(true);

  useEffect(() => {
    if (show) return;
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [show]);

  if (!show && !mounted) return null;

  return (
    <div
      data-anim={anim}
      data-state={show ? "enter" : "exit"}
      className={`fixed inset-0 pointer-events-none ${className}`}
      style={show ? undefined : { pointerEvents: "none" }}
    >
      {show ? children : last}
    </div>
  );
}
