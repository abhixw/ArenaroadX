import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@shared/components/ui/Card";
import { Button } from "@shared/components/ui/Button";
import { ApiError } from "@shared/api/client";
import { useAsyncData } from "@shared/hooks/useAsyncData";
import { getScoringRule, upsertScoringRule } from "@/api/admin/results";
import type { ScoringMethod } from "@/types/admin";

const METHOD_LABELS: Record<ScoringMethod, string> = {
  MANUAL_TOTAL_SCORE: "Manual Total Score",
  PLACEMENT_ONLY: "Placement Only",
  PLACEMENT_AND_KILLS: "Placement + Kills",
  CUSTOM_FORMULA: "Custom Formula (weighted fields)",
};

interface KeyValue {
  key: string;
  value: string;
}

function toEntries(record: Record<string, number> | null | undefined): KeyValue[] {
  return record ? Object.entries(record).map(([key, value]) => ({ key, value: String(value) })) : [];
}

export function ScoringRuleCard({ tournamentId }: { tournamentId: string }) {
  const { data: rule, loading, refetch } = useAsyncData(
    () => getScoringRule(tournamentId).catch(() => null),
    [tournamentId],
  );

  const [method, setMethod] = useState<ScoringMethod>("PLACEMENT_AND_KILLS");
  const [placementPoints, setPlacementPoints] = useState<KeyValue[]>([{ key: "1", value: "10" }]);
  const [killPointValue, setKillPointValue] = useState("1");
  const [fieldWeights, setFieldWeights] = useState<KeyValue[]>([{ key: "score", value: "1" }]);
  const [tieBreak, setTieBreak] = useState("placement");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [initialized, setInitialized] = useState(false);

  if (rule && !initialized) {
    setMethod(rule.method);
    if (rule.placementPoints) setPlacementPoints(toEntries(rule.placementPoints));
    if (rule.killPointValue !== null) setKillPointValue(String(rule.killPointValue));
    if (rule.fieldWeights) setFieldWeights(toEntries(rule.fieldWeights));
    setTieBreak(rule.tieBreakFields.join(", "));
    setInitialized(true);
  }

  function entriesToRecord(entries: KeyValue[]): Record<string, number> {
    const record: Record<string, number> = {};
    for (const e of entries) {
      if (e.key.trim()) record[e.key.trim()] = Number(e.value) || 0;
    }
    return record;
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      await upsertScoringRule(tournamentId, {
        method,
        placementPoints:
          method === "PLACEMENT_ONLY" || method === "PLACEMENT_AND_KILLS" ? entriesToRecord(placementPoints) : undefined,
        killPointValue: method === "PLACEMENT_AND_KILLS" ? Number(killPointValue) : undefined,
        fieldWeights: method === "CUSTOM_FORMULA" ? entriesToRecord(fieldWeights) : undefined,
        tieBreakFields: tieBreak
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      refetch();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save scoring rule.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">Scoring Rule</p>
        {!loading && rule ? <span className="text-xs text-gray-400">Version {rule.version}</span> : null}
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Must be configured before publishing results. Changing it after publication creates a new version.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs font-semibold text-gray-500">Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as ScoringMethod)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400 sm:w-72"
          >
            {Object.entries(METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {method === "PLACEMENT_ONLY" || method === "PLACEMENT_AND_KILLS" ? (
          <EntryListEditor
            label="Placement Points (rank → points)"
            keyPlaceholder="Rank"
            entries={placementPoints}
            onChange={setPlacementPoints}
          />
        ) : null}

        {method === "PLACEMENT_AND_KILLS" ? (
          <div>
            <label className="text-xs font-semibold text-gray-500">Points per Kill</label>
            <input
              type="number"
              value={killPointValue}
              onChange={(e) => setKillPointValue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400 sm:w-40"
            />
          </div>
        ) : null}

        {method === "CUSTOM_FORMULA" ? (
          <EntryListEditor
            label="Field Weights (raw_data field → weight)"
            keyPlaceholder="Field name"
            entries={fieldWeights}
            onChange={setFieldWeights}
          />
        ) : null}

        <div>
          <label className="text-xs font-semibold text-gray-500">Tie-break fields (comma-separated)</label>
          <input
            value={tieBreak}
            onChange={(e) => setTieBreak(e.target.value)}
            placeholder="placement, kills"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
        </div>

        {error ? <p className="text-xs font-medium text-danger-600">{error}</p> : null}
        <Button size="sm" onClick={handleSave} disabled={busy}>
          Save Scoring Rule
        </Button>
      </div>
    </Card>
  );
}

function EntryListEditor({
  label,
  keyPlaceholder,
  entries,
  onChange,
}: {
  label: string;
  keyPlaceholder: string;
  entries: KeyValue[];
  onChange: (entries: KeyValue[]) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500">{label}</label>
      <div className="mt-1 space-y-1.5">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              value={entry.key}
              onChange={(e) => {
                const next = [...entries];
                next[i] = { ...next[i], key: e.target.value };
                onChange(next);
              }}
              placeholder={keyPlaceholder}
              className="w-28 rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary-400"
            />
            <input
              type="number"
              value={entry.value}
              onChange={(e) => {
                const next = [...entries];
                next[i] = { ...next[i], value: e.target.value };
                onChange(next);
              }}
              placeholder="Points"
              className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary-400"
            />
            <button
              type="button"
              aria-label="Remove row"
              onClick={() => onChange(entries.filter((_, idx) => idx !== i))}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange([...entries, { key: "", value: "0" }])}
          className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
        >
          <Plus size={12} /> Add row
        </button>
      </div>
    </div>
  );
}
