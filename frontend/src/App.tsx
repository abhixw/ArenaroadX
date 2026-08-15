import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/NotFound";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";

// Route-level code splitting: everything past the login/register screen is lazy-loaded,
// so a first-time visitor's initial download is just the auth shell, not the entire app
// (including the whole admin dashboard, which most visitors never touch at all).
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Tournaments = lazy(() => import("@/pages/Tournaments"));
const TournamentDetails = lazy(() => import("@/pages/TournamentDetails"));
const MyTournaments = lazy(() => import("@/pages/MyTournaments"));
const Leaderboards = lazy(() => import("@/pages/Leaderboards"));
const LeaderboardDetail = lazy(() => import("@/pages/LeaderboardDetail"));
const Prizes = lazy(() => import("@/pages/Prizes"));
const Profile = lazy(() => import("@/pages/Profile"));
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
              <Route path="/register" element={<Register />} />

              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/tournaments" element={<Tournaments />} />
                <Route path="/tournaments/:id" element={<TournamentDetails />} />
                <Route path="/my-tournaments" element={<MyTournaments />} />
                <Route path="/leaderboards" element={<Leaderboards />} />
                <Route path="/leaderboards/:id" element={<LeaderboardDetail />} />
                <Route path="/prizes" element={<Prizes />} />
                <Route path="/profile" element={<Profile />} />
              </Route>

              {/* AdminLayout redirects non-admins to "/" itself, so this needs no extra gating. */}
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/games" element={<AdminGames />} />
                <Route path="/admin/tournaments" element={<AdminTournaments />} />
                <Route path="/admin/tournaments/:id" element={<AdminTournamentDetail />} />
                <Route path="/admin/players" element={<AdminPlayers />} />
                <Route path="/admin/players/:id" element={<AdminPlayerDetail />} />
                <Route path="/admin/payments" element={<AdminPayments />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
