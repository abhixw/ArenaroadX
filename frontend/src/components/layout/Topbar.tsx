import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Search } from "lucide-react";
import { getNotifications, markAllRead } from "@/api/notifications";
import type { Notification } from "@/types";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

interface TopbarProps {
  title: ReactNode;
  subtitle?: ReactNode;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getNotifications().then(setNotifs).catch(() => {});
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = notifs.filter((n) => !n.read).length;

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/tournaments?search=${encodeURIComponent(query.trim())}`);
    }
  }

  async function onOpenNotifs() {
    setNotifOpen((v) => !v);
    if (!notifOpen && unreadCount > 0) {
      await markAllRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
      </div>

      <div className="flex items-center gap-3">
        <form onSubmit={onSearchSubmit} className="relative hidden md:block">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tournaments..."
            className="w-64 rounded-full border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </form>

        <div className="relative" ref={panelRef}>
          <button
            onClick={onOpenNotifs}
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            ) : null}
          </button>

          {notifOpen ? (
            <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-gray-100 bg-white p-2 shadow-card-lg">
              <p className="px-3 py-2 text-sm font-semibold text-gray-900">Notifications</p>
              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-gray-400">
                    You're all caught up.
                  </p>
                ) : (
                  notifs.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "rounded-xl px-3 py-2.5 text-sm hover:bg-gray-50",
                        !n.read && "bg-primary-50/60",
                      )}
                    >
                      <p className="font-semibold text-gray-800">{n.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{n.body}</p>
                      <p className="mt-1 text-[11px] text-gray-400">{timeAgo(n.createdAt)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
