import { NavLink } from "react-router-dom";
import { CalendarDays, CircleDollarSign, LayoutGrid, LogOut, Shield, Users } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { useAuth } from "@shared/hooks/useAuth";
import { Avatar } from "@shared/components/ui/Avatar";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutGrid, end: true },
  { to: "/tournaments", label: "Tournaments", icon: CalendarDays },
  { to: "/players", label: "Players", icon: Users },
  { to: "/payments", label: "Payments", icon: CircleDollarSign },
];

export function AdminSidebar({ mobile = false }: { mobile?: boolean }) {
  const { user, logout } = useAuth();

  return (
    <aside
      className={cn(
        "w-64 shrink-0 flex-col border-r border-gray-100 bg-gray-950",
        mobile ? "flex h-full" : "hidden lg:flex",
      )}
    >
      <div className="flex items-center gap-2 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 text-white">
          <Shield size={18} fill="currentColor" />
        </div>
        <div>
          <span className="block text-lg font-extrabold tracking-tight text-white">ArenaroadX</span>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-primary-400">Admin</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-500/15 text-primary-300"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200",
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar name={user?.name ?? "Admin"} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user?.handle ?? "Admin"}</p>
            <p className="text-xs text-gray-400">Administrator</p>
          </div>
        </div>
        <button
          onClick={() => void logout()}
          className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-200"
        >
          <LogOut size={16} /> Log out
        </button>
      </div>
    </aside>
  );
}
