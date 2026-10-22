import { useLocation } from "react-router-dom";

/** Re-mounts on every route change so the enter animation replays. */
export default function PageTransition({ children }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="anim-page min-h-dvh">
      {children}
    </div>
  );
}

/** Replays a small slide-in whenever `id` changes (e.g. flow steps). */
export function StepTransition({ id, className = "", children }) {
  return (
    <div key={id} className={`anim-step ${className}`}>
      {children}
    </div>
  );
}
