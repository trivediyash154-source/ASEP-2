"use client";

import { useEffect, useState } from "react";

interface Props {
  format?: "hms" | "hm" | "iso";
  className?: string;
}

/**
 * Mount-safe clock that renders only on the client to avoid hydration mismatch.
 * Updates once per second.
 */
export function LiveClock({ format = "hms", className }: Props) {
  const [t, setT] = useState<Date | null>(null);

  useEffect(() => {
    setT(new Date());
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!t) {
    return <span className={className}>--:--:--</span>;
  }

  if (format === "hm") {
    return (
      <span className={className}>
        {t.toLocaleTimeString("en-IN", { hour12: false, hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  }

  if (format === "iso") {
    return (
      <span className={className}>
        {t.toISOString().replace("T", " ").slice(0, 19)}
      </span>
    );
  }

  return (
    <span className={className}>
      {t.toLocaleTimeString("en-IN", { hour12: false })}
    </span>
  );
}
