import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "@shared/contexts/AuthContext";
import { ErrorBoundary } from "@shared/components/ErrorBoundary";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";

// Route-level code splitting, same rationale as the player app: the login screen is the
// only thing an unauthenticated visitor's first load needs.
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminGames = lazy(() => import("@/pages/admin/AdminGames"));
const AdminTournaments = lazy(() => import("@/pages/admin/AdminTournaments"));
const AdminTournamentDetail = lazy(() => import("@/pages/admin/AdminTournamentDetail"));
const AdminPlayers = lazy(() => import("@/pages/admin/AdminPlayers"));
const AdminPlayerDetail = lazy(() => import("@/pages/admin/AdminPlayerDetail"));
const AdminPayments = lazy(() => import("@/pages/admin/AdminPayments"));

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 size={24} className="animate-spin text-primary-500" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* AdminLayout redirects non-admins itself, so this needs no extra gating. */}
              <Route element={<AdminLayout />}>
                <Route path="/" element={<AdminDashboard />} />
                <Route path="/games" element={<AdminGames />} />
                <Route path="/tournaments" element={<AdminTournaments />} />
                <Route path="/tournaments/:id" element={<AdminTournamentDetail />} />
                <Route path="/players" element={<AdminPlayers />} />
                <Route path="/players/:id" element={<AdminPlayerDetail />} />
                <Route path="/payments" element={<AdminPayments />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
