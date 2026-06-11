"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Thin operations-grade progress strip under the viewport top edge.
 * Fires on every route change: sweeps fast to 80%, completes, fades.
 * Pure CSS transitions — no polling, no router instrumentation.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const first = useRef(true);
  const [state, setState] = useState<{ width: number; visible: boolean }>({ width: 0, visible: false });

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let t2: ReturnType<typeof setTimeout>;
    let t3: ReturnType<typeof setTimeout>;
    setState({ width: 0, visible: true });
    const t1 = setTimeout(() => setState({ width: 82, visible: true }), 20);
    t2 = setTimeout(() => setState({ width: 100, visible: true }), 360);
    t3 = setTimeout(() => setState({ width: 100, visible: false }), 650);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [pathname]);

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[2px] pointer-events-none" aria-hidden>
      <div
        className="h-full bg-gradient-to-r from-sage-500 via-sage-400 to-peach-400"
        style={{
          width: `${state.width}%`,
          opacity: state.visible ? 1 : 0,
          transition: state.width === 0
            ? "none"
            : "width 340ms cubic-bezier(0.16,1,0.3,1), opacity 250ms ease",
          boxShadow: state.visible ? "0 0 8px rgba(169,179,148,0.55)" : "none",
        }}
      />
    </div>
  );
}
