import { useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { PageControls } from "@/components/ui/PageControls";
import { useAsyncData } from "@/hooks/useAsyncData";
import { listUsers } from "@/api/admin/users";
import { formatDate } from "@/lib/utils";

const PAGE_SIZE = 20;

export default function AdminPlayers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data: result, loading, error, refetch } = useAsyncData(
    () => listUsers(search || undefined, page, PAGE_SIZE),
    [search, page],
  );
  // This page manages players, not the operator account -- admins never belong here.
  const users = result?.items.filter((u) => u.role !== "ADMIN");

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <div>
      <Topbar title="Players" subtitle="Search players, view history, and manage account status." />

      <Card className="p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            aria-label="Search by name or email"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </Card>

      <Card className="mt-4 p-0">
        {error ? (
          <div className="p-5">
            <ErrorState message="Couldn't load players." onRetry={refetch} />
          </div>
        ) : loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (users ?? []).length === 0 ? (
          <div className="p-5">
            <EmptyState icon={Search} title="No players found" description="Try a different search term." />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-app-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {(users ?? []).map((u) => (
                    <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-app-bg/40">
                      <td className="px-5 py-3.5 font-medium text-gray-800">
                        <Link to={`/admin/players/${u.id}`} className="hover:text-primary-600 hover:underline">
                          {u.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{u.email}</td>
                      <td className="px-5 py-3.5 text-gray-500">{u.phone ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        <Badge
                          tone={u.status === "ACTIVE" ? "success" : u.status === "SUSPENDED" ? "warning" : "danger"}
                        >
                          {u.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PageControls pagination={result?.pagination ?? null} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
