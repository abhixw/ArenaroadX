import { useEffect, useState } from "react";
import { getCountdownParts, type CountdownParts } from "@/lib/utils";

export function useCountdown(targetIso: string | null | undefined): CountdownParts {
  const [parts, setParts] = useState<CountdownParts>(() =>
    targetIso
      ? getCountdownParts(targetIso)
      : { totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0, expired: true },
  );

  useEffect(() => {
    if (!targetIso) return;
    setParts(getCountdownParts(targetIso));
    const id = setInterval(() => {
      setParts(getCountdownParts(targetIso));
    }, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return parts;
}
