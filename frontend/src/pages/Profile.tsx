import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, LogOut, Mail, Phone } from "lucide-react";
import { Topbar } from "@shared/components/layout/Topbar";
import { Card } from "@shared/components/ui/Card";
import { Button } from "@shared/components/ui/Button";
import { Avatar } from "@shared/components/ui/Avatar";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { Thumb } from "@shared/components/ui/Thumb";
import { useAuth } from "@shared/hooks/useAuth";
import { useAsyncData } from "@shared/hooks/useAsyncData";
import { ApiError } from "@shared/api/client";
import { getRecentResults } from "@/api/results";
import { getTournaments } from "@shared/api/tournaments";
import { computePerformanceStats } from "@/lib/performance";
import { formatDate } from "@shared/lib/utils";

export default function Profile() {
  const { user, logout, updateProfile } = useAuth();
  const { data: tournaments } = useAsyncData(getTournaments);
  const { data: recentResults } = useAsyncData(
    () => (tournaments ? getRecentResults(tournaments) : Promise.resolve([])),
    [tournaments],
  );
  const stats = computePerformanceStats(recentResults ?? []);

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone ?? "");
    }
  }, [user]);

  if (!user) {
    return <Skeleton className="h-96 w-full" />;
  }

  async function handleSave() {
    setBusy(true);
    setSaveError(null);
    try {
      await updateProfile({ name, phone: phone.replace(/[\s-]/g, "") });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Topbar title="Profile" subtitle="Manage your account details." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <Avatar name={user.name} size={64} />
              <div>
                <p className="text-lg font-extrabold text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-400">@{user.handle}</p>
                <p className="mt-1 text-xs text-gray-400">Member since {formatDate(user.createdAt)}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-gray-500">Full name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Email</label>
                <div className="mt-1 flex items-center gap-2 rounded-lg bg-app-bg px-3 py-2 text-sm text-gray-500">
                  <Mail size={14} /> {user.email}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Registered phone</label>
                <div className="mt-1 flex items-center gap-2 rounded-lg bg-app-bg px-3 py-2 text-sm text-gray-500">
                  <Phone size={14} /> {user.phone ?? "Not set"}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Button onClick={handleSave} disabled={busy}>
                {saved ? (
                  <>
                    <Check size={15} /> Saved
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
              <Button variant="ghost" onClick={() => void logout()}>
                <LogOut size={15} /> Log out
              </Button>
            </div>
            {saveError ? <p className="mt-3 text-xs font-medium text-danger-600">{saveError}</p> : null}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900">Tournament History</p>
              <Link to="/my-tournaments" className="text-xs font-semibold text-primary-600 hover:underline">
                View all
              </Link>
            </div>
            <div className="mt-3 space-y-1">
              {(recentResults ?? []).map((r) => (
                <Link
                  key={r.tournamentId}
                  to={`/leaderboards/${r.tournamentId}`}
                  className="flex items-center gap-3 rounded-xl p-2 hover:bg-app-bg"
                >
                  <Thumb src={r.imageUrl} alt={r.tournamentName} className="h-10 w-10 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">{r.tournamentName}</p>
                    <p className="text-xs text-gray-400">{formatDate(r.publishedAt)}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-700">#{r.rank}</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        <Card className="h-fit space-y-3 p-5">
          <p className="text-sm font-bold text-gray-900">Lifetime Stats</p>
          <div className="space-y-2.5 text-sm">
            <Row label="Matches Played" value={stats.matchesPlayed} />
            <Row label="Wins" value={stats.wins} />
            <Row label="Win Rate" value={`${stats.winRate}%`} />
            <Row label="Avg. Placement" value={stats.avgPlacement} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-50 pb-2 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-bold text-gray-900">{value}</span>
    </div>
  );
}
