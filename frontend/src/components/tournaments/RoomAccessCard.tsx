import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import type { Match } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useCountdown } from "@/hooks/useCountdown";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 rounded-lg bg-app-bg px-3 py-2 text-sm font-semibold tracking-wide text-gray-800">
          {value}
        </code>
        <button
          onClick={onCopy}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check size={14} className="text-success-500" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

export function RoomAccessCard({ match }: { match: Match }) {
  const countdown = useCountdown(match.joinWindowClosesAt);
  // The backend only reveals room_id/room_password via a separate, participant-gated
  // /access call once the join window is open (see api/tournaments.ts's getMatchAccess) --
  // by the time a roomId is present here, eligibility has already been confirmed server-side.
  if (!match.roomId) {
    return (
      <Card className="p-5">
        <p className="text-sm font-bold text-gray-900">Match {match.matchNumber} Room Access</p>
        <p className="mt-2 text-sm text-gray-500">
          Room credentials will appear here once the join window opens.
        </p>
      </Card>
    );
  }

  return (
    <Card className="border-primary-100 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">Match {match.matchNumber} Room Access</p>
        <span className="flex items-center gap-1 text-xs font-semibold text-success-600">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-500" />
          Join window open
        </span>
      </div>

      <div className="mt-3 space-y-3">
        <CopyField label="Room ID" value={match.roomId} />
        {match.roomPassword ? <CopyField label="Password" value={match.roomPassword} /> : null}
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Closes in {countdown.hours.toString().padStart(2, "0")}:
        {countdown.minutes.toString().padStart(2, "0")}:
        {countdown.seconds.toString().padStart(2, "0")}
      </p>

      {match.roomUrl ? (
        <a href={match.roomUrl} target="_blank" rel="noreferrer" className="mt-4 block">
          <Button className="w-full gap-2">
            Open Game <ExternalLink size={14} />
          </Button>
        </a>
      ) : null}
    </Card>
  );
}
