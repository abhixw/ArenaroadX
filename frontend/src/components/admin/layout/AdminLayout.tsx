import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Loader2, Menu, Shield, X } from "lucide-react";
import { AdminSidebar } from "@/components/admin/layout/AdminSidebar";
import { useAuth } from "@/hooks/useAuth";

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-app-bg">
        <Loader2 size={28} className="animate-spin text-primary-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin routes are a separate area from the player app -- a USER landing here (e.g. a
  // stale bookmark) gets sent back to their own dashboard, not an error page.
  if (user.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-app-bg">
      <AdminSidebar />

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-gray-900/40" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 flex w-64 flex-col shadow-card-lg">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-gray-300 hover:bg-white/10"
            >
              <X size={18} />
            </button>
            <AdminSidebar mobile />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gray-100 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <Menu size={20} />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500 text-white">
            <Shield size={16} fill="currentColor" />
          </div>
          <span className="text-base font-extrabold text-gray-900">ArenaroadX Admin</span>
        </div>

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
