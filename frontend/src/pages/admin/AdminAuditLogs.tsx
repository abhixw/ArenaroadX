import { Fragment, useState } from "react";
import { ScrollText } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { useAsyncData } from "@/hooks/useAsyncData";
import { listAuditLogs } from "@/api/admin/auditLogs";
import { formatDateTime } from "@/lib/utils";

export default function AdminAuditLogs() {
  const { data: logs, loading } = useAsyncData(() => listAuditLogs(200));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div>
      <Topbar title="Audit Logs" subtitle="Immutable record of every admin action." />

      <Card className="p-0">
        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (logs ?? []).length === 0 ? (
          <div className="p-5">
            <EmptyState icon={ScrollText} title="No admin activity yet" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-app-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Entity</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">When</th>
                </tr>
              </thead>
              <tbody>
                {(logs ?? []).map((log) => (
                  <Fragment key={log.id}>
                    <tr
                      className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-app-bg/40"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      <td className="px-5 py-2.5 font-mono text-xs text-gray-700">{log.action}</td>
                      <td className="px-5 py-2.5 text-gray-500">{log.entity}</td>
                      <td className="px-5 py-2.5">
                        <Badge tone={log.statusCode < 300 ? "success" : log.statusCode < 500 ? "warning" : "danger"}>
                          {log.statusCode}
                        </Badge>
                      </td>
                      <td className="px-5 py-2.5 text-xs text-gray-400">{log.actorId ? log.actorId.slice(-6) : "—"}</td>
                      <td className="px-5 py-2.5 text-xs text-gray-400">{formatDateTime(log.createdAt)}</td>
                    </tr>
                    {expandedId === log.id && log.requestBody ? (
                      <tr className="border-b border-gray-50 bg-app-bg/30">
                        <td colSpan={5} className="px-5 py-3">
                          <pre className="max-h-48 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
                            {JSON.stringify(log.requestBody, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
