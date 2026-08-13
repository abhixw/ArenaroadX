import { NavLink } from "react-router-dom";
import {
  CalendarDays,
  CircleDollarSign,
  Gamepad2,
  Gift,
  LayoutGrid,
  ListChecks,
  Shield,
  Trophy,
  User,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutGrid, end: true },
  { to: "/tournaments", label: "Tournaments", icon: CalendarDays },
  { to: "/my-tournaments", label: "My Tournaments", icon: ListChecks },
  { to: "/leaderboards", label: "Leaderboards", icon: Trophy },
  { to: "/games", label: "Games", icon: Gamepad2 },
  { to: "/game-accounts", label: "Game Accounts", icon: UserCircle },
  { to: "/prizes", label: "Prizes", icon: Gift },
  { to: "/payments", label: "Payments", icon: CircleDollarSign },
  { to: "/profile", label: "Profile", icon: User },
];

export function Sidebar({ mobile = false }: { mobile?: boolean }) {
  const { user } = useAuth();

  return (
    <aside
      className={cn(
        "w-64 shrink-0 flex-col border-r border-gray-100 bg-white",
        mobile ? "flex h-full" : "hidden lg:flex",
      )}
    >
      <div className="flex items-center gap-2 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 text-white">
          <Shield size={18} fill="currentColor" />
        </div>
        <span className="text-lg font-extrabold tracking-tight text-gray-900">Tourney</span>
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
                  ? "bg-primary-50 text-primary-600"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-3">
        <div className="rounded-2xl bg-gray-900 p-4 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <Gamepad2 size={18} />
          </div>
          <p className="mt-3 text-sm font-bold">Join. Compete. Win.</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-300">
            Compete in exciting tournaments and climb the leaderboard.
          </p>
          <NavLink
            to="/tournaments"
            className="mt-3 flex items-center justify-center rounded-xl bg-primary-500 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-600"
          >
            Explore Tournaments
          </NavLink>
        </div>
      </div>

      <NavLink
        to="/profile"
        className="flex items-center gap-3 border-t border-gray-100 px-4 py-4 hover:bg-gray-50"
      >
        <Avatar name={user?.name ?? "Player"} size={36} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {user?.handle ?? "Player"}
          </p>
          <p className="text-xs text-gray-400">Player</p>
        </div>
      </NavLink>
    </aside>
  );
}
